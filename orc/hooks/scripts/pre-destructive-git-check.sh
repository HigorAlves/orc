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
# The ask reason carries the blast radius — what the command would discard,
# measured in the hook's cwd (capped; never fails the hook).
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

cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)
{ [ -n "$cwd" ] && [ -d "$cwd" ]; } || cwd="$PWD"

# Up to 5 lines from stdin as "a, b (+N more)".
first_paths() {
  awk 'NR<=5 {printf "%s%s", (NR>1 ? ", " : ""), $0} END {if (NR>5) printf " (+%d more)", NR-5}'
}

# One sentence on what $1 (the matched shape) would discard; prints nothing it can't measure.
blast_radius() {
  local out n name flags=""
  if ! git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'Blast radius unknown: cwd is not a git work tree.'
    return 0
  fi
  case "$1" in
    "git reset --hard")
      out=$(git -C "$cwd" status --porcelain --untracked-files=no 2>/dev/null | cut -c4-)
      n=$(printf '%s' "$out" | grep -c . || true)
      if [ "$n" -gt 0 ]; then
        printf 'Would discard %s uncommitted change(s): %s.' "$n" "$(printf '%s\n' "$out" | first_paths)"
      else
        printf 'Nothing uncommitted to discard.'
      fi ;;
    "git clean -f")
      case "$command" in *clean*-*d*) flags="$flags -d" ;; esac
      case "$command" in *clean*-*x*) flags="$flags -x" ;; esac
      # shellcheck disable=SC2086 # flags is a deliberate word list
      out=$(git -C "$cwd" clean -n $flags 2>/dev/null | sed 's/^Would remove //')
      n=$(printf '%s' "$out" | grep -c . || true)
      if [ "$n" -gt 0 ]; then
        printf 'Would delete %s untracked path(s): %s.' "$n" "$(printf '%s\n' "$out" | first_paths)"
      else
        printf 'No untracked paths to delete.'
      fi ;;
    "git branch -D")
      name=$(printf '%s' "$command" | grep -oE 'branch[[:space:]]+[^;&|]*-D[[:space:]]+[^[:space:];&|]+' | awk '{print $NF}' | head -1)
      [ -n "$name" ] || return 0
      n=$(git -C "$cwd" rev-list --count "$name" --not HEAD --remotes 2>/dev/null) || return 0
      if [ "$n" -gt 0 ]; then
        printf '%s commit(s) only on %s (not on HEAD or any remote) would become unreachable.' "$n" "$name"
      else
        printf 'Every commit on %s is reachable from HEAD or a remote.' "$name"
      fi ;;
  esac
}

if [ -n "$matched" ]; then
  blast="$(blast_radius "$matched" || true)"
  if [ -n "$blast" ]; then
    blast="$blast (measured in $cwd"
    case "$command" in *"cd "*|*"git -C"*) blast="$blast; the command may target another directory" ;; esac
    blast="$blast) "
  fi
  reason="Destructive git command detected ($matched). ${blast}This rewrites history or discards work irreversibly. Approve only if the user explicitly chose this; prefer safe variants (--force-with-lease, git stash, git branch -d). Override for the session: ORC_ALLOW_DESTRUCTIVE_GIT=1."
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
