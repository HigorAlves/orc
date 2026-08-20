#!/usr/bin/env bash
# PreToolUse(Bash) dispatcher: runs every git/gh guard check against the
# incoming command and merges their verdicts into AT MOST ONE permission
# decision — a single `git push --force` on a protected branch used to
# produce two separate prompts (protected-branch + destructive-git, both
# wired to `Bash(git push*)` in hooks.json); now it produces one.
#
# Merge rule: deny > ask > silent. Reasons concatenate in that order,
# joined with " ALSO: ", so no check's message is ever dropped.
#
# The individual check scripts stay standalone (self-filtering, exit 0
# silently on non-matching commands) — this dispatcher pipes the same
# PreToolUse stdin payload through each and reads their JSON output.
# Overrides (ORC_ALLOW_DESTRUCTIVE_GIT, ORC_ALLOW_AI_ATTRIBUTION) are
# honored inside the checks themselves and pass through unchanged.

set -euo pipefail

input=$(cat)
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

deny_reasons=()
ask_reasons=()

run_check() { # $1 = check script basename
  local out d r
  out=$(printf '%s' "$input" | bash "$script_dir/$1" 2>/dev/null) || out=""
  [ -n "$out" ] || return 0
  d=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null || echo "")
  r=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecisionReason // empty' 2>/dev/null || echo "")
  case "$d" in
    deny) deny_reasons+=("$r") ;;
    ask) ask_reasons+=("$r") ;;
  esac
}

run_check pre-commit-no-ai-attribution.sh
run_check pre-commit-branch-check.sh
run_check pre-destructive-git-check.sh

decision=""
if [ "${#deny_reasons[@]}" -gt 0 ]; then
  decision="deny"
elif [ "${#ask_reasons[@]}" -gt 0 ]; then
  decision="ask"
fi
[ -n "$decision" ] || exit 0

reason=""
append_reason() { # $1 = reason text
  [ -n "$1" ] || return 0
  if [ -z "$reason" ]; then reason="$1"; else reason="$reason ALSO: $1"; fi
}
if [ "${#deny_reasons[@]}" -gt 0 ]; then
  for r in "${deny_reasons[@]}"; do append_reason "$r"; done
fi
if [ "${#ask_reasons[@]}" -gt 0 ]; then
  for r in "${ask_reasons[@]}"; do append_reason "$r"; done
fi

jq -n --arg reason "$reason" --arg decision "$decision" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: $decision,
    permissionDecisionReason: $reason
  }
}'
exit 0
