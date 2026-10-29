#!/usr/bin/env bash
# Guard the project-context layer. Run from the repo root.
#   1. docs/agents/project-context.md, when present, stays under 150 lines / 6144 bytes.
#   2. The four executor agents preload orc:project-context.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

max_lines=150
max_bytes=6144
status=0

ctx="docs/agents/project-context.md"
if [ -f "$ctx" ]; then
  n_lines="$(wc -l < "$ctx" | tr -d ' ')"
  n_bytes="$(wc -c < "$ctx" | tr -d ' ')"
  if [ "$n_lines" -gt "$max_lines" ]; then
    echo "verify-project-context: $ctx is ${n_lines} lines (cap ${max_lines})"
    status=1
  fi
  if [ "$n_bytes" -gt "$max_bytes" ]; then
    echo "verify-project-context: $ctx is ${n_bytes} bytes (cap ${max_bytes})"
    status=1
  fi
fi

for agent in orc-implementer orc-test-author orc-code-fixer orc-qa-validator; do
  f="orc/agents/${agent}.md"
  if ! grep -qE '^[[:space:]]*-[[:space:]]+orc:project-context[[:space:]]*$' "$f"; then
    echo "verify-project-context: $f does not preload orc:project-context"
    status=1
  fi
done

if [ "$status" -eq 0 ]; then
  echo "verify-project-context: OK (cap ${max_lines} lines / ${max_bytes} bytes; preloads intact)"
fi
exit "$status"
