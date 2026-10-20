#!/usr/bin/env bash
# Controlled-language + size lint for orc's agent-facing files (the authoring
# standard: orc/skills/skill-writing/references/AUTHORING-STANDARD.md).
#
#   verify-ste.sh            check against scripts/ci/precision-baseline.json (CI)
#   verify-ste.sh --update   rewrite the baseline from the current tree
#   verify-ste.sh --report   print per-file metrics, worst first
#
# Hard failures: an unapproved word anywhere; a file absent from the baseline
# (new) that exceeds a cap. Ratchet: a file in the baseline may not exceed its
# recorded long-step, non-imperative, passive, body-byte or description counts.
# Prose only — fenced code and frontmatter are skipped. Heuristics, not grammar:
# the counts are a ratchet, not a verdict. Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
baseline="scripts/ci/precision-baseline.json"
mode="${1:-check}"
case "$mode" in
  check|--update|--report|--where) ;;
  *) echo "usage: verify-ste.sh [--update | --report | --where <file>]" >&2; exit 2 ;;
esac

# Size caps (bytes) for files NOT yet in the baseline (new files).
cap_command=6144
cap_agent=8192
cap_skill=6144          # without references/
cap_skill_with_refs=8192
cap_desc=200            # description + when_to_use chars, skills + commands
cap_desc_agent=250

# Unapproved words (STE): pattern|replacement. Word-bounded, case-insensitive.
unapproved='should => must or delete
might => can or state the condition
(to leverage|leverages|leveraged|leveraging) => use
utili[sz](e|es|ed|ing) => use
ensure(s|d)? => verify
in order to => to
prior to => before
subsequently => then
employ(s|ed|ing)? => use
make sure => verify
terminate(s|d)? => stop
commence(s|d)? => start
perhaps => delete; state the condition
ascertain => determine
approximately => about
facilitate(s|d)? => allow, help'

# ---- helpers ----------------------------------------------------------------

# Prose of a markdown file: drop frontmatter and fenced code blocks.
prose() {
  awk '
    NR==1 && $0=="---" { infm=1; next }
    infm && $0=="---" { infm=0; next }
    infm { next }
    /^```/ { fence=!fence; next }
    fence { next }
    { print }
  ' "$1"
}

# Metrics for one file: long notimp passive (space separated).
# A "step" is a list line; the limit is 15 under procedural headings
# (Phase|Workflow|Steps|Process|Mode|Protocol|Loop), else 20.
metrics() {
  prose "$1" | awk '
    function words(s,  n) { gsub(/`[^`]*`/, "x", s); n = split(s, a, /[[:space:]]+/); return n }
    /^#/ { proc = ($0 ~ /Phase|Workflow|Steps|Process|Mode|Protocol|Loop/) ? 1 : 0; next }
    /^[[:space:]]*([0-9]+\.|-|\*|\[ \])[[:space:]]+/ {
      line = $0
      sub(/^[[:space:]]*([0-9]+\.|-|\*|\[ \])[[:space:]]+/, "", line)
      if (line ~ /^\|/) next
      limit = proc ? 15 : 20
      if (words(line) > limit) long++
      if (proc) {
        head = line
        gsub(/\*\*/, "", head); gsub(/`/, "", head)
        sub(/^[^A-Za-z]*/, "", head)
        split(head, w, /[^A-Za-z]/)
        if (w[1] ~ /^(The|A|An|This|That|These|Those|It|Each|Every|Any|Optional|Default|Both|Your|Our|No|One|Two|Three|Four|Five|Also|Then)$/) notimp++
      }
    }
    { lo = " " tolower($0) " "; if (lo ~ /[^a-z](is|are|was|were|be|been|being|gets|get|got) ([a-z]+ed|built|written|read|run|set|done|made|sent|shown|given|kept|left|put|found|held)[^a-z]/) passive++ }
    END { printf "%d %d %d\n", long+0, notimp+0, passive+0 }
  '
}

# description + when_to_use length from frontmatter.
desc_len() {
  awk '
    NR==1 && $0!="---" { exit }
    NR==1 { next }
    /^---$/ { exit }
    /^(description|when_to_use):/ { sub(/^[a-z_]+:[[:space:]]*/, ""); gsub(/^"|"$/, ""); n += length($0) }
    END { print n+0 }
  ' "$1"
}

kind_of() {
  case "$1" in
    orc/commands/*) echo command ;;
    orc/agents/*) echo agent ;;
    *) if [ -d "$(dirname "$1")/references" ]; then echo skill_refs; else echo skill; fi ;;
  esac
}

cap_bytes_for() {
  case "$1" in
    command) echo "$cap_command" ;; agent) echo "$cap_agent" ;;
    skill) echo "$cap_skill" ;; skill_refs) echo "$cap_skill_with_refs" ;;
  esac
}
cap_desc_for() { if [ "$1" = agent ]; then echo "$cap_desc_agent"; else echo "$cap_desc"; fi; }

files=()
while IFS= read -r f; do files+=("$f"); done < <(find orc/commands orc/agents -maxdepth 1 -name "*.md" -print; find orc/skills -maxdepth 2 -name SKILL.md -print | sort)

# ---- unapproved words (always hard) ----------------------------------------
status=0
hits=0
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  pat="${entry%% => *}"; fix="${entry#* => }"
  for f in "${files[@]}"; do
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      hits=$((hits + 1))
      [ "$mode" = "--report" ] || echo "verify-ste: $f: unapproved '$(printf '%s' "$line" | grep -oiE "\b($pat)\b" | head -1)' → $fix :: ${line:0:90}"
    done < <(prose "$f" | grep -v '^|' | sed -E 's/"[^"]*"//g; s/“[^”]*”//g' | grep -iE "\b($pat)\b" || true)
  done
done <<< "$unapproved"

# ---- metrics ----------------------------------------------------------------
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
for f in "${files[@]}"; do
  read -r long notimp passive < <(metrics "$f")
  bytes=$(prose "$f" | wc -c | tr -d ' ')   # body only: frontmatter is budgeted by desc, code is skipped
  desc=$(desc_len "$f")
  printf '%s %s %s %s %s %s %s\n' "$f" "$(kind_of "$f")" "$long" "$notimp" "$passive" "$bytes" "$desc" >> "$tmp"
done

if [ "$mode" = "--update" ]; then
  jq -Rn '
    [inputs | split(" ") | {key: .[0], value: {kind: .[1], long: (.[2]|tonumber), notimp: (.[3]|tonumber), passive: (.[4]|tonumber), bytes: (.[5]|tonumber), desc: (.[6]|tonumber)}}]
    | from_entries | {files: .}' "$tmp" > "$baseline"
  echo "verify-ste: baseline rewritten ($(jq '.files | length' "$baseline") files)"
  awk '{l+=$3; n+=$4; p+=$5; d+=$7} END {printf "verify-ste: totals long=%d notimp=%d passive=%d desc_chars=%d\n", l, n, p, d}' "$tmp"
  exit 0
fi

if [ "$mode" = "--report" ]; then
  echo "file                                               long notimp passive  bytes desc"
  sort -k3,3nr -k4,4nr "$tmp" | awk '{printf "%-50s %4d %6d %7d %6d %4d\n", $1, $3, $4, $5, $6, $7}'
  awk '{l+=$3; n+=$4; p+=$5; d+=$7} END {printf "totals: long=%d notimp=%d passive=%d desc_chars=%d\n", l, n, p, d}' "$tmp"
  echo "unapproved words: $hits"
  exit 0
fi

# ---- module codes: every phase module opens with its code -----------------------
while IFS= read -r m; do
  head -1 "$m" | grep -qE '^<!-- orc:[a-z0-9-]+/[A-Za-z0-9.-]+ -->$' && continue
  echo "verify-ste: $m: first line must be the module code <!-- orc:<command>/P<N> -->"; status=1
done < <({ find orc/skills/phases/references -mindepth 2 -name '*.md'; find orc/skills -path '*/references/PHASE-*.md' -not -path '*/phases/*'; } | sort)

# ---- check -------------------------------------------------------------------
[ "$hits" -eq 0 ] || status=1
[ -f "$baseline" ] || { echo "verify-ste: $baseline missing — run scripts/ci/verify-ste.sh --update"; exit 1; }

tighten=0
while read -r f kind long notimp passive bytes desc; do
  if jq -e --arg f "$f" '.files[$f]' "$baseline" >/dev/null; then
    # shellcheck disable=SC2034  # read through indirect expansion below
    read -r b_long b_notimp b_passive b_bytes b_desc < <(jq -r --arg f "$f" '.files[$f] | "\(.long) \(.notimp) \(.passive) \(.bytes) \(.desc)"' "$baseline")
    for m in long notimp passive bytes desc; do
      cur="${!m}"; b="b_$m"; base="${!b}"
      if [ "$cur" -gt "$base" ]; then
        echo "verify-ste: $f: $m rose $base → $cur (ratchet: a file may only improve)"; status=1
      elif [ "$cur" -lt "$base" ]; then tighten=1; fi
    done
  else
    cap=$(cap_bytes_for "$kind"); dcap=$(cap_desc_for "$kind")
    [ "$bytes" -le "$cap" ] || { echo "verify-ste: $f: new $kind is $bytes bytes (cap $cap)"; status=1; }
    [ "$desc" -le "$dcap" ] || { echo "verify-ste: $f: new $kind description is $desc chars (cap $dcap)"; status=1; }
    [ "$long" -eq 0 ] || { echo "verify-ste: $f: new file has $long steps over the word limit"; status=1; }
    [ "$notimp" -eq 0 ] || { echo "verify-ste: $f: new file has $notimp steps not opening with a verb"; status=1; }
  fi
done < "$tmp"

if [ "$status" -eq 0 ]; then
  echo "verify-ste: OK (no unapproved words; $(wc -l < "$tmp" | tr -d ' ') files within ratchet/caps)"
  [ "$tighten" -eq 0 ] || echo "verify-ste: note — some files improved; run scripts/ci/verify-ste.sh --update to tighten the baseline"
fi
exit "$status"
