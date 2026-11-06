#!/usr/bin/env bash
# WorktreeRemove hook for the orc plugin.
#
# Fires when a harness-managed worktree is being removed (session exit or a
# worktree-isolated subagent finishing). Side-effects only — this event
# cannot block. The hook refuses to touch anything outside the pinned
# .orc/.worktrees/ location and never removes a dirty tree.

set -euo pipefail

payload=""
if [ ! -t 0 ]; then
  payload="$(cat 2>/dev/null || true)"
fi

wt_path=""
if [ -n "$payload" ] && command -v jq >/dev/null 2>&1; then
  wt_path="$(printf '%s' "$payload" | jq -r '.worktreePath // .path // empty' 2>/dev/null || true)"
fi

if [ -z "$wt_path" ]; then
  echo "orc worktree-remove: no worktreePath in payload — nothing to do" >&2
  exit 0
fi

case "$wt_path" in
  */.orc/.worktrees/*) ;;  # pinned location — ok
  *)
    echo "orc worktree-remove: refusing to remove ${wt_path} — outside .orc/.worktrees/" >&2
    exit 0
    ;;
esac

if [ ! -d "$wt_path" ]; then
  exit 0
fi

# Never delete user work: skip dirty trees (the harness/user can force later).
if [ -n "$(git -C "$wt_path" status --porcelain 2>/dev/null)" ]; then
  echo "orc worktree-remove: ${wt_path} has uncommitted changes — skipped" >&2
  exit 0
fi

repo_root="$(git -C "$wt_path" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | sed 's@/\.git$@@' || true)"
git -C "${repo_root:-$wt_path}" worktree remove "$wt_path" >&2 || \
  echo "orc worktree-remove: git worktree remove failed for ${wt_path} (left in place)" >&2
git -C "${repo_root:-.}" worktree prune >&2 2>/dev/null || true

exit 0
