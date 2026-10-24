#!/usr/bin/env bash
# shellcheck disable=SC2016  # $vars inside single quotes are jq program variables
# stage.sh — factory stage packs: list, validate, render, run.
# Sourced by bin/orc-stage. Pure bash + jq; no sed on user text (criteria may
# contain slashes and ampersands), placeholders are substituted by jq split/join.
# Contract schemas: orc/factory/schema/*.json.

ORC_STAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORC_STAGE_IDS='["triage","test_design","implementing","verifying","e2e","evidence","ci_watch","reviewing_memory"]'

orc_stage__packs_file() { printf '%s\n' "${ORC_FACTORY_STAGES:-${ORC_STAGE_ROOT}/factory/stages.json}"; }

orc_stage__die() { # <code> <message>
  echo "orc-stage: $2" >&2
  return "$1"
}

# Prints one line per pack: <id>\t<agent|script>\t<writable>\t<tools,joined>
orc_stage_packs() {
  local f
  f="$(orc_stage__packs_file)"
  jq -r '.packs | to_entries[] | [.key, (.value.agent // "script"), (.value.writable|tostring), (.value.tools|join(","))] | @tsv' "$f"
}

# <schema> <file> — structural check (required keys, enums, types).
# <schema> is a path to a contract schema; its basename picks the check.
# Exit 0 valid; 1 with the first failing key on stderr; 2 on unreadable file.
orc_stage_validate_jq() {
  local schema="$1" file="$2" kind key
  jq empty "$file" 2>/dev/null || { echo "orc-stage: $file is not valid JSON" >&2; return 2; }
  case "$(basename "$schema")" in
    stage-input.json) kind=input ;;
    stage-output.json) kind=output ;;
    stages.json) kind=stages ;;
    *) echo "orc-stage: unknown schema $schema" >&2; return 2 ;;
  esac
  key="$(jq -r --arg kind "$kind" --argjson ids "$ORC_STAGE_IDS" '
    def checks:
      if $kind == "input" then [
        ["schema", (.schema|IN(1,2))],
        ["stage", (.stage|type)=="string"],
        ["pack", (.pack as $p | $ids|index($p)!=null)],
        ["attempt", (.attempt|type)=="number"],
        ["task", (.task|type)=="object"],
        ["plan", ((.plan|type)=="object" or .plan==null)],
        ["decisions", (.decisions|type)=="array"],
        ["priorFindings", (.priorFindings|type)=="array"],
        ["context", (.context|type)=="object"],
        ["limits.maxTurns", (.limits.maxTurns|type)=="number"],
        ["limits.timeoutMs", (.limits.timeoutMs|type)=="number"],
        ["env", (.env|type)=="object"]]
      elif $kind == "output" then [
        ["schema", (.schema|IN(1,2))],
        ["ok", (.ok|type)=="boolean"],
        ["outcome", (.outcome|IN("pass","fail","needs_input","test_change","escalated")) and (.schema==2 or .outcome!="escalated")],
        ["summary", (.summary|type)=="string"],
        ["requested", (.requested|type)=="array"],
        ["findings", (.findings|type)=="array"],
        ["artifacts", (.artifacts|type)=="array"],
        ["artifacts[].kind", ((.artifacts|type)=="array") and all(.artifacts[]; .kind|IN("qa-manifest","screenshot","video","har","report","test","diff","findings","rules"))],
        ["requested[].kind", ((.requested|type)=="array") and all(.requested[]; .kind|IN("tracker_write","pr_review_post","publish"))],
        ["slices.done", (.slices.done|type)=="number"],
        ["slices.total", (.slices.total|type)=="number"],
        ["usage", (.usage|type)=="object"],
        ["rateLimited", (.rateLimited|type)=="boolean"]]
      else [
        ["schema", .schema==1],
        ["packs", (.packs|type)=="object"],
        ["packs ids", ((.packs|type)=="object") and ((.packs|keys|sort) == ($ids|sort))]]
      end;
    (try (checks | map(select(.[1] != true)) | .[0][0]) catch "(root)") // empty' "$file")" || key="(root)"
  if [ -n "$key" ]; then
    echo "orc-stage: $file fails $kind check at key: $key" >&2
    return 1
  fi
  return 0
}

# validate --input F | --output F | --packs
orc_stage_validate() {
  local sdir="${ORC_STAGE_ROOT}/factory/schema"
  case "${1:-}" in
    --input)  [ -n "${2:-}" ] || { orc_stage__die 2 "validate --input needs a file"; return; }
              orc_stage_validate_jq "$sdir/stage-input.json" "$2" ;;
    --output) [ -n "${2:-}" ] || { orc_stage__die 2 "validate --output needs a file"; return; }
              orc_stage_validate_jq "$sdir/stage-output.json" "$2" ;;
    --packs)  orc_stage_validate_jq "$sdir/stages.json" "$(orc_stage__packs_file)" ;;
    *)        orc_stage__die 2 "validate: expected --input <file> | --output <file> | --packs" ;;
  esac
}

# Built-in template, used when the pack's promptTemplate file does not exist.
orc_stage__default_template() {
  cat <<'TPL'
## Task
Title: {{task.title}}
Branch: {{task.branch}}

{{task.description}}

Acceptance criteria:
{{task.criteria}}

## Plan
Brief: {{plan.brief}}

Plan criteria:
{{plan.criteria}}

Assumptions:
{{plan.assumptions}}

## Decisions so far
{{decisions}}

## Prior findings
{{priorFindings}}

## Project context
{{context.projectContext}}

## Run
Attempt {{attempt}} as {{agent}}. Skills: {{skills}}
TPL
}

# Resolve a promptTemplate path: as given, then relative to the plugin root
# (with and without the leading "orc/"). Prints nothing when absent.
orc_stage__template_path() { # <promptTemplate>
  local p="$1" c
  [ -n "$p" ] || return 0
  for c in "$p" "${ORC_STAGE_ROOT}/../$p" "${ORC_STAGE_ROOT}/${p#orc/}"; do
    if [ -f "$c" ]; then printf '%s\n' "$c"; return 0; fi
  done
}

# render <pack> <stage.json> — stage prompt to stdout.
orc_stage_render() {
  local pack="${1:-}" input="${2:-}" pf tpl_rel tpl_file tpl
  if [ -z "$pack" ] || [ -z "$input" ]; then orc_stage__die 2 "render <pack> <stage.json>"; return; fi
  pf="$(orc_stage__packs_file)"
  jq -e --arg p "$pack" '.packs[$p]' "$pf" >/dev/null 2>&1 \
    || { orc_stage__die 2 "unknown pack: $pack"; return; }
  if ! { [ -f "$input" ] && jq empty "$input" 2>/dev/null; }; then
    orc_stage__die 2 "cannot read stage input: $input"; return
  fi
  tpl_rel="$(jq -r --arg p "$pack" '.packs[$p].promptTemplate // ""' "$pf")"
  tpl_file="$(orc_stage__template_path "$tpl_rel")"
  if [ -n "$tpl_file" ]; then tpl="$(cat "$tpl_file")"; else tpl="$(orc_stage__default_template)"; fi

  # context.projectContext null: fall back to the worktree's project context file.
  local pc=""
  if [ -f docs/agents/project-context.md ]; then pc="$(cat docs/agents/project-context.md)"; fi

  jq -rn --arg pack "$pack" --arg tpl "$tpl" --arg pc "$pc" --slurpfile packs "$pf" --slurpfile in "$input" '
    def txt: if . == null or . == "" then "(none)" else tostring end;
    def bullets: if . == null or length == 0 then "(none)" else map("- " + tostring) | join("\n") end;
    def lines(f): if . == null or length == 0 then "(none)" else map(f) | join("\n") end;
    ($packs[0].packs[$pack]) as $pk | ($in[0]) as $i |
    ($pk.agent // "script") as $agent |
    {
      "{{task.title}}": ($i.task.title | txt),
      "{{task.description}}": ($i.task.description | txt),
      "{{task.criteria}}": ($i.task.criteria | bullets),
      "{{task.branch}}": ($i.task.branch | txt),
      "{{plan.brief}}": ($i.plan.brief? | txt),
      "{{plan.criteria}}": ($i.plan.criteria? | bullets),
      "{{plan.assumptions}}": ($i.plan.assumptions? | bullets),
      "{{decisions}}": ($i.decisions | lines("- \(.decision) at \(.at): \(if (.reason // "") != "" then .reason elif (.answers // {}) != {} then (.answers|tojson) else "(none)" end)")),
      "{{priorFindings}}": ($i.priorFindings | lines("- \(.severity) \(.path):\(.line) \(.title)")),
      "{{context.testCases}}": ($i.context.testCases? | lines("- \(.title)\(if (.criterion // "") != "" then " (proves: \(.criterion))" else "" end): \(.test)")),
      "{{context.projectContext}}": (($i.context.projectContext // "") | if . == "" then $pc else . end | txt),
      "{{attempt}}": ($i.attempt | txt),
      "{{agent}}": $agent,
      "{{skills}}": (($pk.skills // []) | if length == 0 then "(none)" else join(", ") end)
    } as $subs |
    "You are the `\($agent)` role running the `\($pack)` stage in factory mode (ORC_FACTORY=1). Follow orc:gates §8: no AskUserQuestion; questions end the stage as needs_input; outward actions go to requested[]. Answer with JSON matching the pack outputSchema.",
    ($pk.outputSchema | tojson),
    "",
    (reduce ($subs | to_entries[]) as $e ($tpl; split($e.key) | join($e.value))),
    # dontAsk denies a whole call when any part of it is not allow-listed, so the pack is
    # told its exact commands; a denial must not end the stage.
    (($pk.tools // []) | map(select(startswith("Bash(")) | ltrimstr("Bash(") | rtrimstr(")") | rtrimstr(":*")) | unique) as $cmds |
    if ($cmds | length) > 0 then
      "", "## Shell",
      "Bash runs only these commands: \($cmds | map("`" + . + "`") | join(", ")).",
      "Run one command per call: no `;`, `&&`, `||`, pipes or redirects. Look at files with Read, Glob and Grep, not `ls`, `cat` or `head`.",
      "A denied command is never a reason to escalate: run it alone, or use another listed command or tool."
    else empty end'
}

# run --in <stage.json> --out <dir> [--plugin-root <path>] [--dry-run]
# Validates the input, renders the prompt, then hands off to lib/factory/run.mjs
# (Agent SDK). Exit: 1 invalid input | 2 usage | 4 node missing | 5 result invalid.
orc_stage_run() {
  local in="" out="" proot="${ORC_PLUGIN_ROOT:-}" dry="" pack pf pack_json fdir
  while [ $# -gt 0 ]; do
    case "$1" in
      --in)          in="${2:-}"; shift 2 ;;
      --out)         out="${2:-}"; shift 2 ;;
      --plugin-root) proot="${2:-}"; shift 2 ;;
      --dry-run)     dry=1; shift ;;
      *) orc_stage__die 2 "run: unknown arg $1"; return ;;
    esac
  done
  if [ -z "$in" ] || [ -z "$out" ]; then orc_stage__die 2 "run --in <stage.json> --out <dir> [--plugin-root <path>] [--dry-run]"; return; fi
  [ -f "$in" ] || { orc_stage__die 2 "cannot read stage input: $in"; return; }
  orc_stage_validate_jq "${ORC_STAGE_ROOT}/factory/schema/stage-input.json" "$in" || return 1
  command -v node >/dev/null 2>&1 || { orc_stage__die 4 "node is required for run (not found on PATH)"; return; }
  pack="$(jq -r '.pack' "$in")"
  pf="$(orc_stage__packs_file)"
  pack_json="$(jq -c --arg p "$pack" '.packs[$p] // empty' "$pf")"
  [ -n "$pack_json" ] || { orc_stage__die 2 "unknown pack: $pack"; return; }
  [ -n "$proot" ] || proot="$ORC_STAGE_ROOT"
  mkdir -p "$out"
  out="$(cd "$out" && pwd)"
  in="$(cd "$(dirname "$in")" && pwd)/$(basename "$in")"
  orc_stage_render "$pack" "$in" > "$out/prompt.md" || return
  fdir="${ORC_STAGE_ROOT}/lib/factory"
  # Read-only sandbox: keep orc state and HOME on writable ground.
  if [ -z "${ORC_STATE_DIR:-}" ] && [ ! -w "$PWD" ]; then
    local br
    br="$(git branch --show-current 2>/dev/null || true)"
    br="$(printf '%s' "${br:-detached}" | tr '/' '-' | tr -c 'a-zA-Z0-9._-' '-')"
    export ORC_STATE_DIR="${TMPDIR:-/tmp}/orc-state/${br}"
    mkdir -p "$ORC_STATE_DIR"
    echo "orc-stage: cwd is read-only; state in $ORC_STATE_DIR" >&2
  fi
  if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ] || [ ! -w "$HOME" ]; then
    export HOME="${TMPDIR:-/tmp}"
  fi
  if [ -z "$dry" ] && [ "$(jq -r '.agent // "null"' <<<"$pack_json")" != "null" ] && [ ! -d "$fdir/node_modules/@anthropic-ai/claude-agent-sdk" ]; then
    if [ ! -w "$fdir" ]; then
      orc_stage__die 4 "Agent SDK missing in $fdir and the directory is read-only; run the preinstall step (npm install --omit=dev --prefix $fdir) when building the image"; return
    fi
    echo "orc-stage: installing the Agent SDK into $fdir (first run)" >&2
    npm install --omit=dev --no-audit --no-fund --prefix "$fdir" >&2 || { orc_stage__die 4 "npm install failed"; return; }
  fi
  local rc=0
  ORC_FACTORY=1 ORC_STAGE_IN="$in" ORC_STAGE_OUT="$out" ORC_STAGE_PROMPT="$out/prompt.md" \
    ORC_STAGE_PACK_JSON="$pack_json" ORC_PLUGIN_ROOT="$proot" ORC_STAGE_DRY_RUN="$dry" \
    node "${fdir}/run.mjs" || rc=$?
  [ "$rc" = 0 ] || return "$rc"
  orc_stage_validate_jq "${ORC_STAGE_ROOT}/factory/schema/stage-output.json" "$out/result.json" \
    || { orc_stage__die 5 "result.json failed the output contract"; return; }
}
