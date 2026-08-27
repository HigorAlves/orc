#!/usr/bin/env bash
# Guard the project-context layer's two invariants:
#   1. The size cap the orc:project-context skill declares is the SAME number
#      the consumers quote. The file loads into every executor agent on every
#      implementation task, so a drifted cap is a permanent token tax that
#      nothing else would catch.
#   2. If this repo has its own project-context.md, it is actually under the cap.
# Run from the repo root.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

skill="orc/skills/project-context/SKILL.md"
status=0

[ -f "$skill" ] || { echo "verify-project-context: $skill is missing"; exit 1; }

# --- 1. the cap is declared once and quoted consistently -------------------
cap_lines="$(grep -oE '\*\*[0-9]+ lines / [0-9]+ KB, hard\.\*\*' "$skill" | grep -oE '^\*\*[0-9]+' | tr -d '*' || true)"
cap_kb="$(grep -oE '\*\*[0-9]+ lines / [0-9]+ KB, hard\.\*\*' "$skill" | grep -oE '[0-9]+ KB' | grep -oE '^[0-9]+' || true)"
if [ -z "$cap_lines" ] || [ -z "$cap_kb" ]; then
  echo "verify-project-context: $skill must declare the cap as '**<N> lines / <N> KB, hard.**'"
  exit 1
fi

# Every other mention of the cap must use the same pair. Any "<N> lines / <N> KB"
# anywhere in the plugin is treated as a quote of the cap — there is exactly one
# such quantity in orc, so a stray match means real drift, not a false positive.
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  f="${hit%%:*}"
  quoted="${hit#*:}"
  q_lines="$(printf '%s' "$quoted" | grep -oE '^[0-9]+')"
  q_kb="$(printf '%s' "$quoted" | grep -oE '[0-9]+[[:space:]]*KB' | grep -oE '^[0-9]+')"
  if [ "$q_lines" != "$cap_lines" ] || [ "$q_kb" != "$cap_kb" ]; then
    echo "verify-project-context: $f quotes cap '$quoted' but the skill declares ${cap_lines} lines / ${cap_kb} KB"
    status=1
  fi
done < <(grep -roE --include='*.md' '[0-9]+ lines / [0-9]+[[:space:]]*KB' \
           orc/commands orc/skills orc/agents 2>/dev/null || true)

# --- 2. required sections are named in the skill ---------------------------
for section in "Stack & versions" "Critical rules" "Patterns to follow" \
               "Patterns to avoid" "Testing conventions" "Known landmines"; do
  grep -qF "$section" "$skill" || {
    echo "verify-project-context: $skill no longer names the '$section' section"
    status=1
  }
done

# --- 3. this repo's own context file, if any, respects the cap -------------
for candidate in docs/agents/project-context.md .orc/project-context.md; do
  [ -f "$candidate" ] || continue
  n_lines="$(wc -l < "$candidate" | tr -d ' ')"
  n_bytes="$(wc -c < "$candidate" | tr -d ' ')"
  max_bytes=$((cap_kb * 1024))
  if [ "$n_lines" -gt "$cap_lines" ]; then
    echo "verify-project-context: $candidate is ${n_lines} lines (cap ${cap_lines})"
    status=1
  fi
  if [ "$n_bytes" -gt "$max_bytes" ]; then
    echo "verify-project-context: $candidate is ${n_bytes} bytes (cap ${max_bytes})"
    status=1
  fi
done

# --- 4. the consumers that preload the skill actually still do -------------
for agent in orc-implementer orc-test-author orc-code-fixer orc-qa-validator; do
  grep -q 'orc:project-context' "orc/agents/${agent}.md" || {
    echo "verify-project-context: orc/agents/${agent}.md no longer preloads orc:project-context"
    status=1
  }
done

if [ "$status" -eq 0 ]; then
  echo "verify-project-context: OK (cap ${cap_lines} lines / ${cap_kb} KB consistent; sections + preloads intact)"
fi
exit "$status"
