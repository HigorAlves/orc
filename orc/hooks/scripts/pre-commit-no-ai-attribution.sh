#!/usr/bin/env bash
# PreToolUse(Bash) guard: refuses `git commit` and `gh pr|issue create|edit`
# whose message/body contains AI-attribution markers (Co-Authored-By: Claude,
# Generated with Claude Code, the 🤖 marker emoji, noreply@anthropic.com).
#
# Enforces orc iron rule #5 ("No AI attribution") at the tool layer so the
# default Claude Code system prompt — which actively asks the model to add
# the trailer — cannot win the race against the rule.
#
# Override (rare; only when the user has explicitly opted in):
#   ORC_ALLOW_AI_ATTRIBUTION=1
#
# Reads the tool input as JSON on stdin (PreToolUse contract).

set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only intercept message-bearing commands.
case "$command" in
  git\ commit*|gh\ pr\ create*|gh\ pr\ edit*|gh\ issue\ create*|gh\ issue\ edit*) ;;
  *) exit 0 ;;
esac

# Explicit per-shop override.
if [ "${ORC_ALLOW_AI_ATTRIBUTION:-}" = "1" ]; then
  exit 0
fi

# Patterns to refuse. Tight by design — must match the AI-attribution shape
# specifically, not bare mentions of "claude" (so commit messages like
# `chore(claude-plugin): bump` aren't false-positively blocked).
patterns=(
  'Co-Authored-By:[[:space:]]*Claude'
  'Co-Authored-By:.*<noreply@anthropic\.com>'
  'Generated with[[:space:]]+(\[)?Claude Code'
  'noreply@anthropic\.com'
  '🤖'
)

matched=""
for p in "${patterns[@]}"; do
  if printf '%s' "$command" | grep -qiE "$p"; then
    matched="$p"
    break
  fi
done

if [ -n "$matched" ]; then
  op="git commit"
  case "$command" in
    gh\ pr\ create*) op="gh pr create" ;;
    gh\ pr\ edit*) op="gh pr edit" ;;
    gh\ issue\ create*) op="gh issue create" ;;
    gh\ issue\ edit*) op="gh issue edit" ;;
  esac

  reason="AI attribution detected in $op message/body (matched: $matched). orc iron rule #5: never mention Claude, AI, or automation in commits/PRs. Re-run with the trailer removed — the default system prompt asks for these trailers; orc strips that policy. Override only with explicit user consent: ORC_ALLOW_AI_ATTRIBUTION=1."
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

exit 0
