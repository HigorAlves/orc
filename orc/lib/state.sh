#!/usr/bin/env bash
# shellcheck disable=SC2016  # $vars inside single quotes are jq program variables
# state.sh — the single writer for .orc/ session state (schema 1).
# Sourced by bin/orc-state. Registry (.orc/orc.json) and the per-session
# checkpoint frontmatter are written by the same code path, so the mirror
# cannot drift. All registry writes are atomic (jq > tmp && mv).
# Schema doctrine lives in the orc:state-protocol skill.

ORC_STATE_STATUSES="in_progress paused completed abandoned"
ORC_STATE_SLICE_STATUSES="pending red green committed escalated skipped"
ORC_STATE_DIGEST_MAX_LINES=30
ORC_STATE_DIGEST_MAX_BYTES=2048

orc_state__dir() {
  if [ -n "${ORC_STATE_DIR:-}" ]; then
    printf '%s\n' "$ORC_STATE_DIR"
    return 0
  fi
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -z "$root" ]; then
    echo "orc-state: ORC_STATE_DIR not set and not inside a git repo" >&2
    return 1
  fi
  printf '%s/.orc\n' "$root"
}

orc_state__registry() { printf '%s/orc.json\n' "$(orc_state__dir)"; }

orc_state__now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

orc_state__sanitize() { # $1 = raw branch name
  printf '%s' "$1" | tr '/' '-' | tr -c 'a-zA-Z0-9._-' '-'
}

orc_state__current_branch() { git branch --show-current 2>/dev/null || true; }

# Resolve a branch argument (raw or sanitized; empty = current git branch)
# to a sessionId.
orc_state__sid() { # $1 = branch arg (may be empty)
  local b="$1"
  if [ -z "$b" ]; then b="$(orc_state__current_branch)"; fi
  if [ -z "$b" ]; then
    echo "orc-state: no branch given and no current git branch" >&2
    return 1
  fi
  orc_state__sanitize "$b"
}

orc_state__ensure_registry() {
  local reg
  reg="$(orc_state__registry)"
  if [ ! -f "$reg" ]; then
    mkdir -p "$(dirname "$reg")"
    printf '{"schema": 1, "sessions": []}\n' > "$reg"
  fi
}

# Atomic registry update. $1 = jq program operating on the whole document;
# remaining args are passed to jq verbatim (e.g. --arg sid ...).
orc_state__update() {
  local prog="$1" reg
  shift
  reg="$(orc_state__registry)"
  orc_state__ensure_registry
  jq "$@" "$prog" "$reg" > "$reg.tmp" && mv "$reg.tmp" "$reg"
}

orc_state__entry() { # $1 = sid; prints entry JSON or fails
  local reg
  reg="$(orc_state__registry)"
  [ -f "$reg" ] || { echo "orc-state: no registry at $reg" >&2; return 1; }
  jq -e --arg sid "$1" '.sessions[] | select(.sessionId == $sid or .branch == $sid)' "$reg" 2>/dev/null || {
    echo "orc-state: no session for '$1'" >&2
    return 1
  }
}

orc_state__checkpoint_path() { # $1 = sid
  printf '%s/%s/files/checkpoint.md\n' "$(orc_state__dir)" "$1"
}

orc_state__slices_path() { # $1 = sid
  printf '%s/%s/files/slices.json\n' "$(orc_state__dir)" "$1"
}

# Everything after the closing --- of the frontmatter (empty if no file).
orc_state__checkpoint_body() { # $1 = sid
  local f
  f="$(orc_state__checkpoint_path "$1")"
  [ -f "$f" ] || return 0
  awk 'seen == 2 { print } /^---$/ { if (seen < 2) { seen++; next } }' "$f"
}

orc_state__default_body() {
  cat <<'EOF'

## Resume digest
- Done: nothing — session initialized
- Next: phase 1
- Open decisions: none
- Artifacts: none
- Suite: unknown
EOF
}

# Regenerate checkpoint.md: frontmatter from the registry entry (the mirror),
# body preserved (or the default skeleton on first write).
orc_state__write_checkpoint() { # $1 = sid
  local sid="$1" f body fm
  f="$(orc_state__checkpoint_path "$sid")"
  mkdir -p "$(dirname "$f")"
  body="$(orc_state__checkpoint_body "$sid")"
  [ -n "$body" ] || body="$(orc_state__default_body)"
  fm="$(orc_state__entry "$sid" | jq -r '
    ["---",
     "schema: 1",
     "command: \(.command)",
     "branch: \(.sessionId)",
     "gitBranch: \(.gitBranch)",
     "phase: \(.phase)"]
    + (if .phaseLabel then ["phaseLabel: \(.phaseLabel)"] else [] end)
    + ["totalPhases: \(.totalPhases)",
       "status: \(.status)"]
    + (if .jiraTicket then ["jiraTicket: \(.jiraTicket)"] else [] end)
    + ["updatedAt: \(.updatedAt)",
       "---"]
    | .[]')"
  printf '%s\n%s\n' "$fm" "$body" > "$f"
}

orc_state__touch() { # $1 = sid — bump updatedAt + rewrite the mirror
  orc_state__update '(.sessions[] | select(.sessionId == $sid) | .updatedAt) = $now' \
    --arg sid "$1" --arg now "$(orc_state__now)"
  orc_state__write_checkpoint "$1"
}

orc_state_init() { # --command C --total-phases N [--branch B] [--description D] [--jira K] [--scope S] [--repos a,b] [--plan-file P]
  local command="" total="" branch="" description="" jira="" scope="" repos="" plan_file=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --command)      command="${2:-}"; shift 2 ;;
      --total-phases) total="${2:-}"; shift 2 ;;
      --branch)       branch="${2:-}"; shift 2 ;;
      --description)  description="${2:-}"; shift 2 ;;
      --jira)         jira="${2:-}"; shift 2 ;;
      --scope)        scope="${2:-}"; shift 2 ;;
      --repos)        repos="${2:-}"; shift 2 ;;
      --plan-file)    plan_file="${2:-}"; shift 2 ;;
      *) echo "orc-state init: unknown argument $1" >&2; return 2 ;;
    esac
  done
  [ -n "$command" ] && [ -n "$total" ] || { echo "orc-state init: --command and --total-phases are required" >&2; return 2; }
  if [ -z "$branch" ]; then branch="$(orc_state__current_branch)"; fi
  [ -n "$branch" ] || { echo "orc-state init: no --branch and no current git branch" >&2; return 2; }
  local sid now
  sid="$(orc_state__sanitize "$branch")"
  now="$(orc_state__now)"
  orc_state__ensure_registry
  orc_state__update '
    .schema = 1
    | if any(.sessions[]; .sessionId == $sid) then
        (.sessions[] | select(.sessionId == $sid)) |=
          (.command = $command | .description = $description
           | .totalPhases = ($total | tonumber) | .updatedAt = $now)
      else
        .sessions += [{
          sessionId: $sid, command: $command, branch: $sid, gitBranch: $branch,
          description: $description, status: "in_progress",
          phase: 1, phaseLabel: "init", totalPhases: ($total | tonumber),
          jiraTicket: (if $jira == "" then null else $jira end),
          planFile: (if $plan_file == "" then null else $plan_file end),
          linkedPRs: [], startedAt: $now, updatedAt: $now
        } + (if $scope == "" then {} else {scope: $scope} end)
          + (if $repos == "" then {} else {repos: ($repos | split(","))} end)]
      end' \
    --arg sid "$sid" --arg branch "$branch" --arg command "$command" \
    --arg description "$description" --arg total "$total" --arg now "$now" \
    --arg jira "$jira" --arg scope "$scope" --arg repos "$repos" \
    --arg plan_file "$plan_file"
  orc_state__write_checkpoint "$sid"
  printf '%s\n' "$sid"
}

orc_state_get() { # [branch] [--field F]
  local branch="" field=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --field) field="${2:-}"; shift 2 ;;
      *) branch="$1"; shift ;;
    esac
  done
  local sid entry
  sid="$(orc_state__sid "$branch")" || return 1
  entry="$(orc_state__entry "$sid")" || return 1
  if [ -n "$field" ]; then
    printf '%s\n' "$entry" | jq -r --arg f "$field" '.[$f] // empty'
  else
    printf '%s\n' "$entry"
  fi
}

orc_state_current() {
  local b
  b="$(orc_state__current_branch)"
  [ -n "$b" ] || { echo "orc-state current: no current git branch" >&2; return 1; }
  orc_state_get "$b"
}

orc_state_sessions() { # [--status S]
  local want=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --status) want="${2:-}"; shift 2 ;;
      *) echo "orc-state sessions: unknown argument $1" >&2; return 2 ;;
    esac
  done
  local reg
  reg="$(orc_state__registry)"
  [ -f "$reg" ] || return 0
  jq -r --arg want "$want" '
    .sessions[]
    | select($want == "" or .status == $want)
    | "\(.sessionId)\t\(.command)\t\(.phase)/\(.totalPhases)\t\(.status)\t\(.gitBranch)"' "$reg"
}

orc_state_phase_set() { # <n|done> [--label L] [--branch B]
  local phase="" label="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --label)  label="${2:-}"; shift 2 ;;
      --branch) branch="${2:-}"; shift 2 ;;
      *) phase="$1"; shift ;;
    esac
  done
  [ -n "$phase" ] || { echo "orc-state phase set: phase required (<n|done>)" >&2; return 2; }
  case "$phase" in
    done|[0-9]*) : ;;
    *) echo "orc-state phase set: phase must be an integer or 'done'" >&2; return 2 ;;
  esac
  local sid
  sid="$(orc_state__sid "$branch")" || return 1
  orc_state__entry "$sid" >/dev/null || return 1
  orc_state__update '
    (.sessions[] | select(.sessionId == $sid)) |=
      (.phase = ($phase | tonumber? // $phase)
       | (if $label != "" then .phaseLabel = $label else . end)
       | .updatedAt = $now)' \
    --arg sid "$sid" --arg phase "$phase" --arg label "$label" --arg now "$(orc_state__now)"
  orc_state__write_checkpoint "$sid"
}

orc_state_status_set() { # <status> [--branch B]
  local new="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch="${2:-}"; shift 2 ;;
      *) new="$1"; shift ;;
    esac
  done
  case " $ORC_STATE_STATUSES " in
    *" $new "*) : ;;
    *) echo "orc-state status set: '$new' not in: $ORC_STATE_STATUSES" >&2; return 2 ;;
  esac
  local sid
  sid="$(orc_state__sid "$branch")" || return 1
  orc_state__entry "$sid" >/dev/null || return 1
  orc_state__update '
    (.sessions[] | select(.sessionId == $sid)) |= (.status = $new | .updatedAt = $now)' \
    --arg sid "$sid" --arg new "$new" --arg now "$(orc_state__now)"
  orc_state__write_checkpoint "$sid"
}

orc_state_link_pr() { # --repo R --url U [--number N] [--stack-id S] [--stack-position P] [--stacked-on U2] [--branch B]
  local repo="" url="" number="" stack_id="" stack_pos="" stacked_on="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --repo)           repo="${2:-}"; shift 2 ;;
      --url)            url="${2:-}"; shift 2 ;;
      --number)         number="${2:-}"; shift 2 ;;
      --stack-id)       stack_id="${2:-}"; shift 2 ;;
      --stack-position) stack_pos="${2:-}"; shift 2 ;;
      --stacked-on)     stacked_on="${2:-}"; shift 2 ;;
      --branch)         branch="${2:-}"; shift 2 ;;
      *) echo "orc-state link-pr: unknown argument $1" >&2; return 2 ;;
    esac
  done
  [ -n "$repo" ] && [ -n "$url" ] || { echo "orc-state link-pr: --repo and --url are required" >&2; return 2; }
  local sid
  sid="$(orc_state__sid "$branch")" || return 1
  orc_state__entry "$sid" >/dev/null || return 1
  orc_state__update '
    (.sessions[] | select(.sessionId == $sid)) |=
      (.linkedPRs += [{
         repo: $repo, url: $url,
         number: ($number | tonumber? // null),
         stackId: (if $stack_id == "" then null else $stack_id end),
         stackPosition: ($stack_pos | tonumber? // null),
         stackedOn: (if $stacked_on == "" then null else $stacked_on end)
       }] | .updatedAt = $now)' \
    --arg sid "$sid" --arg repo "$repo" --arg url "$url" --arg number "$number" \
    --arg stack_id "$stack_id" --arg stack_pos "$stack_pos" \
    --arg stacked_on "$stacked_on" --arg now "$(orc_state__now)"
  orc_state__write_checkpoint "$sid"
}

orc_state_digest_write() { # - [--branch B]   (digest text on stdin)
  local src="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch="${2:-}"; shift 2 ;;
      -) src="-"; shift ;;
      *) echo "orc-state digest write: only stdin input ('-') is supported" >&2; return 2 ;;
    esac
  done
  [ "$src" = "-" ] || { echo "orc-state digest write: pass '-' and pipe the digest on stdin" >&2; return 2; }
  local sid
  sid="$(orc_state__sid "$branch")" || return 1
  orc_state__entry "$sid" >/dev/null || return 1

  local tmp_raw tmp_in raw_lines
  tmp_raw="$(mktemp)"
  tmp_in="$(mktemp)"
  cat > "$tmp_raw"
  raw_lines="$(wc -l < "$tmp_raw" | tr -d ' ')"
  head -n "$ORC_STATE_DIGEST_MAX_LINES" "$tmp_raw" > "$tmp_in"
  rm -f "$tmp_raw"
  if [ "$raw_lines" -gt "$ORC_STATE_DIGEST_MAX_LINES" ]; then
    echo "orc-state digest write: truncated to $ORC_STATE_DIGEST_MAX_LINES lines" >&2
  fi
  while [ "$(wc -c < "$tmp_in" | tr -d ' ')" -gt "$ORC_STATE_DIGEST_MAX_BYTES" ]; do
    sed -i.bak '$d' "$tmp_in" && rm -f "$tmp_in.bak"
    echo "orc-state digest write: dropped a line to fit ${ORC_STATE_DIGEST_MAX_BYTES}B" >&2
  done

  local body tmp_body
  body="$(orc_state__checkpoint_body "$sid")"
  [ -n "$body" ] || body="$(orc_state__default_body)"
  tmp_body="$(mktemp)"
  printf '%s\n' "$body" | awk -v dfile="$tmp_in" '
    /^## Resume digest$/ && !done {
      print
      while ((getline line < dfile) > 0) print line
      close(dfile)
      done = 1; skipping = 1; next
    }
    skipping && /^## / { skipping = 0 }
    skipping { next }
    { print }
    END {
      if (!done) {
        print ""
        print "## Resume digest"
        while ((getline line < dfile) > 0) print line
        close(dfile)
      }
    }' > "$tmp_body"

  # Bump updatedAt, then rewrite the file with the new body under fresh frontmatter.
  orc_state__update '(.sessions[] | select(.sessionId == $sid) | .updatedAt) = $now' \
    --arg sid "$sid" --arg now "$(orc_state__now)"
  local f fm
  f="$(orc_state__checkpoint_path "$sid")"
  mkdir -p "$(dirname "$f")"
  fm="$(orc_state__entry "$sid" | jq -r '
    ["---",
     "schema: 1",
     "command: \(.command)",
     "branch: \(.sessionId)",
     "gitBranch: \(.gitBranch)",
     "phase: \(.phase)"]
    + (if .phaseLabel then ["phaseLabel: \(.phaseLabel)"] else [] end)
    + ["totalPhases: \(.totalPhases)",
       "status: \(.status)"]
    + (if .jiraTicket then ["jiraTicket: \(.jiraTicket)"] else [] end)
    + ["updatedAt: \(.updatedAt)",
       "---"]
    | .[]')"
  { printf '%s\n' "$fm"; cat "$tmp_body"; } > "$f"
  rm -f "$tmp_in" "$tmp_body"
}

orc_state_slice_init() { # <slices.json path> [--branch B]
  local src="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) branch="${2:-}"; shift 2 ;;
      *) src="$1"; shift ;;
    esac
  done
  [ -f "$src" ] || { echo "orc-state slice init: file not found: $src" >&2; return 2; }
  jq -e '.slices | type == "array"' "$src" >/dev/null 2>&1 || {
    echo "orc-state slice init: $src is not a slices.json (needs .slices array)" >&2
    return 2
  }
  local sid dest
  sid="$(orc_state__sid "$branch")" || return 1
  dest="$(orc_state__slices_path "$sid")"
  mkdir -p "$(dirname "$dest")"
  jq '.' "$src" > "$dest.tmp" && mv "$dest.tmp" "$dest"
}

orc_state_slice_set() { # <id> --status S [--commit SHA] [--actual-loc N] [--note S] [--branch B]
  local id="" new="" commit="" actual_loc="" note="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --status)     new="${2:-}"; shift 2 ;;
      --commit)     commit="${2:-}"; shift 2 ;;
      --actual-loc) actual_loc="${2:-}"; shift 2 ;;
      --note)       note="${2:-}"; shift 2 ;;
      --branch)     branch="${2:-}"; shift 2 ;;
      *) id="$1"; shift ;;
    esac
  done
  [ -n "$id" ] && [ -n "$new" ] || { echo "orc-state slice set: <id> and --status are required" >&2; return 2; }
  case " $ORC_STATE_SLICE_STATUSES " in
    *" $new "*) : ;;
    *) echo "orc-state slice set: '$new' not in: $ORC_STATE_SLICE_STATUSES" >&2; return 2 ;;
  esac
  local sid ledger
  sid="$(orc_state__sid "$branch")" || return 1
  ledger="$(orc_state__slices_path "$sid")"
  [ -f "$ledger" ] || { echo "orc-state slice set: no slices.json for $sid (run slice init)" >&2; return 1; }
  jq --arg id "$id" --arg new "$new" --arg commit "$commit" \
     --arg actual_loc "$actual_loc" --arg note "$note" '
    (.slices[] | select((.id | tostring) == $id)) |=
      (.status = $new
       | (if $commit != "" then .commit = $commit else . end)
       | (if $actual_loc != "" then .actualLoc = ($actual_loc | tonumber) else . end)
       | (if $note != "" then .note = $note else . end))' \
    "$ledger" > "$ledger.tmp" && mv "$ledger.tmp" "$ledger"
}

orc_state_slice_list() { # [--status a,b,c] [--branch B]
  local want="" branch=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --status) want="${2:-}"; shift 2 ;;
      --branch) branch="${2:-}"; shift 2 ;;
      *) echo "orc-state slice list: unknown argument $1" >&2; return 2 ;;
    esac
  done
  local sid ledger
  sid="$(orc_state__sid "$branch")" || return 1
  ledger="$(orc_state__slices_path "$sid")"
  [ -f "$ledger" ] || { echo "orc-state slice list: no slices.json for $sid" >&2; return 1; }
  if [ -z "$want" ]; then
    jq -r '.slices[] | "\(.id)\t\(.status)\t\(.title)\t\(.commit // "-")"' "$ledger"
    return 0
  fi
  # Completion-query semantics: print matches; exit 0 only when NOTHING matches
  # (so `slice list --status pending,red,escalated` gates "all done").
  local matches
  matches="$(jq -r --arg want "$want" '
    ($want | split(",")) as $set
    | .slices[] | select(.status as $s | $set | index($s))
    | "\(.id)\t\(.status)\t\(.title)"' "$ledger")"
  if [ -n "$matches" ]; then
    printf '%s\n' "$matches"
    return 1
  fi
  return 0
}

orc_state_verify() { # [branch]
  local branch="${1:-}" sid entry f errs=0
  sid="$(orc_state__sid "$branch")" || return 1
  entry="$(orc_state__entry "$sid")" || return 1
  f="$(orc_state__checkpoint_path "$sid")"
  if [ ! -f "$f" ]; then
    echo "orc-state verify: missing checkpoint at $f" >&2
    return 1
  fi
  grep -q '^schema: 1$' "$f" || { echo "orc-state verify: checkpoint missing 'schema: 1'" >&2; errs=1; }
  grep -q '^## Resume digest$' "$f" || { echo "orc-state verify: checkpoint missing Resume digest section" >&2; errs=1; }
  local reg_phase ck_phase reg_status ck_status
  reg_phase="$(printf '%s\n' "$entry" | jq -r '.phase')"
  reg_status="$(printf '%s\n' "$entry" | jq -r '.status')"
  ck_phase="$(awk -F': ' '/^phase: /{print $2; exit}' "$f")"
  ck_status="$(awk -F': ' '/^status: /{print $2; exit}' "$f")"
  [ "$reg_phase" = "$ck_phase" ] || { echo "orc-state verify: phase mismatch (registry $reg_phase vs checkpoint $ck_phase)" >&2; errs=1; }
  [ "$reg_status" = "$ck_status" ] || { echo "orc-state verify: status mismatch (registry $reg_status vs checkpoint $ck_status)" >&2; errs=1; }
  local dbytes
  dbytes="$(awk '/^## Resume digest$/{f=1; next} /^## /{f=0} f' "$f" | wc -c | tr -d ' ')"
  [ "$dbytes" -le "$((ORC_STATE_DIGEST_MAX_BYTES + 256))" ] || { echo "orc-state verify: digest over cap ($dbytes bytes)" >&2; errs=1; }
  return "$errs"
}

orc_state_migrate() {
  local reg
  reg="$(orc_state__registry)"
  [ -f "$reg" ] || { echo "orc-state migrate: no registry to migrate" >&2; return 1; }
  jq '
    .schema = 1
    | .sessions = [ (.sessions // [])[]
        | . as $s
        | ($s.branch // $s.gitBranch // "unknown") as $rawbranch
        | ($rawbranch | gsub("/"; "-")) as $sid
        | {
            sessionId: $sid,
            command: ($s.command // "unknown"),
            branch: $sid,
            gitBranch: ($s.gitBranch // $rawbranch),
            description: ($s.description // ""),
            status: ($s.status // "completed"),
            phase: ($s.current_phase
                    // (if ($s.phase | type) == "number" then $s.phase else null end)
                    // "done"),
            phaseLabel: (if ($s.phase | type) == "string" then $s.phase else $s.phaseLabel // null end),
            totalPhases: ($s.totalPhases // $s.total_phases // 0),
            jiraTicket: ($s.jiraTicket // null),
            planFile: ($s.planFile // null),
            linkedPRs: ($s.linkedPRs // []),
            startedAt: ($s.startedAt // $s.created_at // null),
            updatedAt: ($s.updatedAt // $s.updated_at // $s.startedAt // $s.created_at // null)
          }
        + (if $s.scope then {scope: $s.scope} else {} end)
        + (if $s.repos then {repos: $s.repos} else {} end)
        + (if $s.perRepoState then {perRepoState: $s.perRepoState} else {} end)
      ]' "$reg" > "$reg.tmp" && mv "$reg.tmp" "$reg"
  echo "orc-state migrate: registry migrated to schema 1"
}
