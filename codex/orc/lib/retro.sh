#!/usr/bin/env bash
# Mechanical half of `/orc:retro --propose` (orc:retro/P5): the arithmetic and
# incident bookkeeping run in jq, never by model judgment. Pure functions over
# files; writes nothing. Usage:
#   retro.sh calibration <slices.json>
#   retro.sh incidents <files-dir> <session-branch>
#   retro.sh patterns <current-incidents.json> [<prior-incidents.json>...]
#   retro.sh missing <files-dir>
set -euo pipefail

orc_retro_calibration() { # <slices.json>
  jq -c '
    [.slices[]? | select(.status == "committed" and (.estLoc // 0) > 0 and .actualLoc != null)
      | (.actualLoc / .estLoc)] | sort as $r
    | ($r | length) as $n
    | { schema: 1,
        estLocBias: (if $n == 0 then 1
          else ((if $n % 2 == 1 then $r[($n - 1) / 2] else ($r[$n / 2 - 1] + $r[$n / 2]) / 2 end) * 100 | round / 100) end),
        sampleSize: $n,
        generatedAt: (now | todate) }' "$1"
}

orc_retro_incidents() { # <files-dir> <session-branch>
  local dir="$1" br="$2" f
  {
    if [ -f "$dir/slices.json" ]; then
      jq -c --arg b "$br" '.slices[]?
        | ( select(.status == "escalated") | {kind: "escalation", evidence: (.note // .title)} ),
          ( select((.retries // 0) > 0) | {kind: "retry", evidence: ("slice \(.id) retried: \(.title)")} )
        | . + {sessionBranch: $b}' "$dir/slices.json"
    fi
    if [ -f "$dir/qa-verdict.json" ]; then
      jq -c --arg b "$br" '.checks[]? | select(.result == "fail")
        | {kind: "qa-fail", evidence: (.criterion // .id), sessionBranch: $b}' "$dir/qa-verdict.json"
    fi
    if [ -f "$dir/review-findings.json" ]; then
      jq -c --arg b "$br" '(.findings // .)[]? | select(.severity == "bug" or .severity == "security")
        | {kind: ("review-" + .severity), evidence: (.title // .summary // .message), sessionBranch: $b}' "$dir/review-findings.json"
    fi
    for f in "$dir"/ci-*.json; do
      [ -f "$f" ] || continue
      jq -c --arg b "$br" 'select((.classification // .verdict // "") | IN("green", "pass", "") | not)
        | {kind: "ci", evidence: "\(.classification // .verdict): \(.summary // "")", sessionBranch: $b}' "$f"
    done
  } | jq -s -c '.'
}

orc_retro_patterns() { # <current.json> [<prior.json>...]
  jq -s -c '
    add
    | map(. + {key: ((.kind + " " + ((.evidence // "") | ascii_downcase | split(" ") | map(select(. != "")) | .[:6] | join(" "))))})
    | group_by(.key)
    | map(select(length >= 2)
        | {key: .[0].key, kind: .[0].kind, count: length,
           evidence: (map(.evidence) | unique), sessions: (map(.sessionBranch) | unique)})' "$@"
}

orc_retro_missing() { # <files-dir>
  local dir="$1" f out=()
  for f in usage.jsonl slices.json decisions.json qa-verdict.json review-findings.json; do
    [ -f "$dir/$f" ] || out+=("$f")
  done
  ls "$dir"/ci-*.json >/dev/null 2>&1 || out+=("ci-*.json")
  printf '%s\n' "${out[@]+"${out[@]}"}" | jq -R -s -c 'split("\n") | map(select(. != ""))'
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  verb="${1:-}"
  [ $# -gt 0 ] && shift
  case "$verb" in
    calibration) orc_retro_calibration "$@" ;;
    incidents) orc_retro_incidents "$@" ;;
    patterns) orc_retro_patterns "$@" ;;
    missing) orc_retro_missing "$@" ;;
    *) echo "usage: retro.sh calibration|incidents|patterns|missing ..." >&2; exit 2 ;;
  esac
fi
