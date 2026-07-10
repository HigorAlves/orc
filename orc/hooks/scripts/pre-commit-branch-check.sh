#!/usr/bin/env bash
# PreToolUse(Bash) guard: intercepts `git commit` and `git push` on protected
# branches and downgrades them to a confirm prompt via permissionDecision
# "ask" — one keystroke to proceed deliberately, no env-var escape hatch.
# Reads the tool input as JSON on stdin (PreToolUse contract).
# Protected set: plugin userConfig `protected_branches` (comma-separated,
# exported as CLAUDE_PLUGIN_OPTION_PROTECTED_BRANCHES), default
# main,master,develop.

set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only intercept commits and pushes — including compound commands
# (`cd x && git push`, `npm test; git commit`) and `git -C <path>`.
git_subcmd_re='(^|[;&|][[:space:]]*)git([[:space:]]+-[Cc][[:space:]]*[^[:space:]]+)*[[:space:]]+(commit|push)([[:space:]]|$)'
if ! printf '%s' "$command" | grep -qE "$git_subcmd_re"; then
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

protected="${CLAUDE_PLUGIN_OPTION_PROTECTED_BRANCHES:-main,master,develop}"
is_protected=0
IFS=',' read -ra protected_list <<< "$protected"
for p in "${protected_list[@]}"; do
  p="$(printf '%s' "$p" | xargs)"   # trim whitespace
  if [ -n "$p" ] && [ "$branch" = "$p" ]; then is_protected=1; break; fi
done

case "$is_protected" in
  1)
    op="commit"
    if printf '%s' "$command" | grep -qE '(^|[;&|][[:space:]]*)git([[:space:]]+-[Cc][[:space:]]*[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)'; then
      op="push"
    fi
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
