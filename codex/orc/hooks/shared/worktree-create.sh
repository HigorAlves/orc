#!/usr/bin/env bash
# WorktreeCreate hook for the orc plugin.
#
# Claude Code fires this when a worktree is being created (--worktree flag or
# an agent with `isolation: worktree`). The hook REPLACES the default git
# behavior: it must print the worktree path to stdout, or exit non-zero to
# fail the creation. orc pins every harness-managed worktree under
# <repo>/.orc/.worktrees/<sanitized-branch> — the same never-$HOME location
# the orc:using-git-worktrees skill mandates for manually-created trees.
#
# Contract: worktree path on stdout; everything else to stderr.

set -euo pipefail

payload=""
if [ ! -t 0 ]; then
  payload="$(cat 2>/dev/null || true)"
fi

branch=""
cwd=""
if [ -n "$payload" ] && command -v jq >/dev/null 2>&1; then
  branch="$(printf '%s' "$payload" | jq -r '.branch // .branchName // .name // empty' 2>/dev/null || true)"
  cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null || true)"
fi
[ -z "$cwd" ] && cwd="$PWD"

repo_root="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "orc worktree-create: cwd is not inside a git repo ($cwd)" >&2
  exit 1
fi

if [ -z "$branch" ]; then
  echo "orc worktree-create: no branch in payload — cannot name the worktree" >&2
  exit 1
fi

sanitized="$(printf '%s' "$branch" | tr '/' '-' | sed -e 's/[^A-Za-z0-9._-]/-/g')"
wt_path="${repo_root}/.orc/.worktrees/${sanitized}"

mkdir -p "${repo_root}/.orc/.worktrees"

# The pinned location must be gitignored — warn (don't fail) when it isn't,
# mirroring the using-git-worktrees iron rule. (The dir must exist first:
# a trailing-slash .gitignore pattern like `.orc/` only matches real dirs.)
if ! git -C "$repo_root" check-ignore -q .orc 2>/dev/null; then
  echo "orc worktree-create: WARNING — .orc/ is not gitignored in ${repo_root}; the worktree will show up in git status" >&2
fi

# Idempotence + collision handling (mirrors /orc:start's collision table):
#  - path already registered as a worktree for this branch -> reuse
#  - branch exists                                          -> add without -b
#  - fresh                                                  -> add with -b
if git -C "$repo_root" worktree list --porcelain 2>/dev/null | grep -qx "worktree ${wt_path}"; then
  echo "orc worktree-create: reusing existing worktree at ${wt_path}" >&2
elif git -C "$repo_root" rev-parse --verify --quiet "refs/heads/${branch}" >/dev/null 2>&1; then
  git -C "$repo_root" worktree add "$wt_path" "$branch" >&2
else
  git -C "$repo_root" worktree add "$wt_path" -b "$branch" >&2
fi

printf '%s\n' "$wt_path"
exit 0
