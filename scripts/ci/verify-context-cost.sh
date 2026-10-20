#!/usr/bin/env bash
# Ratchet the plugin's always-on context cost. Claude Code loads every
# component's description (+ when_to_use) into every session; this sums those
# characters across skills, commands and agents and compares the total to the
# one recorded in scripts/ci/precision-baseline.json. The total may only fall.
# `claude plugin details orc` gives the harness's own projection when the
# plugin is installed; this proxy runs anywhere. Run from the repo root.
#   verify-context-cost.sh          check
#   verify-context-cost.sh --print  print the current total and estimate
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
baseline="scripts/ci/precision-baseline.json"

desc_len() {
  awk '
    NR==1 && $0!="---" { exit }
    NR==1 { next }
    /^---$/ { exit }
    /^(description|when_to_use):/ { sub(/^[a-z_]+:[[:space:]]*/, ""); gsub(/^"|"$/, ""); n += length($0) }
    END { print n+0 }
  ' "$1"
}

total=0; files=0
while IFS= read -r f; do
  total=$((total + $(desc_len "$f"))); files=$((files + 1))
done < <({ find orc/commands orc/agents -maxdepth 1 -name '*.md'; find orc/skills -maxdepth 2 -name SKILL.md; } | sort)

est=$((total / 4))
if [ "${1:-}" = "--print" ]; then
  echo "verify-context-cost: ${total} description chars over ${files} components (~${est} always-on tokens by chars/4)"
  exit 0
fi

[ -f "$baseline" ] || { echo "verify-context-cost: $baseline missing — run scripts/ci/verify-ste.sh --update"; exit 1; }
base=$(jq '[.files[].desc] | add' "$baseline")
if [ "$total" -gt "$base" ]; then
  echo "verify-context-cost: always-on description total rose ${base} → ${total} chars (ratchet: it may only fall; shorten a description or run verify-ste.sh --update after a deliberate change)"
  exit 1
fi
echo "verify-context-cost: OK (${total} chars ≤ baseline ${base}; ~${est} always-on tokens)"
