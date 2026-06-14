#!/usr/bin/env bash
# PreToolUse(run_shell_command) guard for ORC Gemini CLI.
# Refuses `git commit` and `git push` on protected branches.

set -euo pipefail

# Read the tool input as JSON on stdin.
# Gemini CLI payload: { "tool_name": "run_shell_command", "tool_input": { "command": "..." } }
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only intercept commits and pushes.
case "$command" in
  git\ commit*|git\ push*) ;;
  *) exit 0 ;;
esac

# Explicit override.
if [ "${ORC_ALLOW_PROTECTED:-}" = "1" ]; then
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

case "$branch" in
  main|master|develop)
    op="commit"
    case "$command" in
      git\ push*) op="push" ;;
    esac
    cat >&2 <<EOF
BLOCKED: cannot $op directly on protected branch '$branch'.

Create a feature branch first:
  git checkout -b feat/your-feature-name

Or, if intentional, set ORC_ALLOW_PROTECTED=1 and re-run.
EOF
    exit 2
    ;;
esac

exit 0
