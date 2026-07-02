#!/usr/bin/env bash
# PreToolUse(Bash) guard: intercepts `git commit` and `git push` on protected
# branches (main, master, develop) and downgrades them to a confirm prompt via
# permissionDecision "ask" — one keystroke to proceed deliberately, no env-var
# escape hatch. Reads the tool input as JSON on stdin (PreToolUse contract).

set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only intercept commits and pushes.
case "$command" in
  git\ commit*|git\ push*) ;;
  *) exit 0 ;;
esac

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

case "$branch" in
  main|master|develop)
    op="commit"
    case "$command" in
      git\ push*) op="push" ;;
    esac
    reason="orc iron rule #1: '$branch' is a protected branch. Prefer a feature branch (git checkout -b feat/…). Approve only if the user explicitly chose to $op on '$branch'."
    jq -n --arg reason "$reason" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: $reason
      }
    }'
    exit 0
    ;;
esac

exit 0
