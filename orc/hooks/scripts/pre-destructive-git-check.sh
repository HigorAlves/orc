#!/usr/bin/env bash
# PreToolUse(Bash) guard: downgrades destructive git commands to a confirm
# prompt via permissionDecision "ask" — history rewrites and forced deletions
# are one keystroke to proceed deliberately, never silent.
#
# Gated shapes (adapted from mattpocock/skills git-guardrails, which hard-
# denies; orc gates instead so a user-approved rebase/cleanup still flows):
#   git reset --hard            (any args)
#   git clean -f / -fd / -fdx   (any -f* force flag)
#   git branch -D               (forced delete; -d stays silent)
#   git push --force / -f       (--force-with-lease stays silent — stack-pr
#                                republishing depends on it)
# Compound commands (`npm test && git reset --hard`) and `git -C <path>`
# forms are matched. Prose mentions inside quoted strings are not.
#
# Override (rare; explicit user opt-in): ORC_ALLOW_DESTRUCTIVE_GIT=1
# Reads the tool input as JSON on stdin (PreToolUse contract).

set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Explicit per-shop override.
if [ "${ORC_ALLOW_DESTRUCTIVE_GIT:-}" = "1" ]; then
  exit 0
fi

# A git invocation at a command boundary (start or after ; & |), with
# optional -C <path>, followed by the subcommand.
git_prefix='(^|[;&|][[:space:]]*)git([[:space:]]+-[Cc][[:space:]]*[^[:space:]]+)*[[:space:]]+'

matched=""
if printf '%s' "$command" | grep -qE "${git_prefix}reset([[:space:]]+[^;&|]*)?[[:space:]]--hard([[:space:]]|$)"; then
  matched="git reset --hard"
elif printf '%s' "$command" | grep -qE "${git_prefix}clean[[:space:]]+[^;&|]*-[a-eg-zA-Z]*f"; then
  matched="git clean -f"
elif printf '%s' "$command" | grep -qE "${git_prefix}branch[[:space:]]+[^;&|]*(-D([[:space:]]|$)|--delete[[:space:]]+[^;&|]*--force|--force[[:space:]]+[^;&|]*--delete)"; then
  matched="git branch -D"
elif printf '%s' "$command" | grep -qE "${git_prefix}push[[:space:]]+[^;&|]*(--force([[:space:]]|$)|-f([[:space:]]|$))"; then
  matched="git push --force"
fi

if [ -n "$matched" ]; then
  reason="Destructive git command detected ($matched). This rewrites history or discards work irreversibly. Approve only if the user explicitly chose this; prefer safe variants (--force-with-lease, git stash, git branch -d). Override for the session: ORC_ALLOW_DESTRUCTIVE_GIT=1."
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

exit 0
