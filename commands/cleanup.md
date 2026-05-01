---
description: Clean up after completed (or abandoned) orc sessions — removes the .orc/<branch>/ workspace state, removes the registry entry, removes any associated git worktree, and optionally deletes the merged feature branch. Destructive operation — always shows a preview and asks before doing anything.
argument-hint: "[--dry-run] [--all-completed] [<session-id-or-branch>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git worktree:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(rm -rf .orc:*)
---

# /orc:cleanup

Close the loop on finished orc work — remove the workspace state, the worktree, and (if safe) the local feature branch.

## Arguments

- `<session-id-or-branch>` — optional. Clean up exactly one session. Accepts the `session_id` from `.orc/orc.json` or a (sanitized or raw) branch name.
- `--all-completed` — clean up every session whose `status` in `.orc/orc.json` is `completed` or `abandoned`. Respects all the safety checks below per session.
- `--dry-run` — print what *would* happen but make no changes. Recommended for the first run.

## Workflow

### Phase 1 — Refuse to run from inside a soon-to-be-deleted worktree

```bash
current_path=$(pwd)
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
```

If a session about to be cleaned up matches the current worktree path or current branch, abort with a clear message: "You're inside the worktree this command would remove. `cd` to the main repo first."

### Phase 2 — Read the registry

Read `.orc/orc.json`. If absent or empty, surface and stop. If a specific session was requested but not found, surface and stop (don't silently no-op).

### Phase 3 — Build the candidate list

If `<session-id-or-branch>` was given: 1 candidate. If `--all-completed`: every session with `status` in `{completed, abandoned}`. Otherwise: render all sessions and prompt via `AskUserQuestion`:

```
1. plan       feat-142-notifs        completed   2 days ago
2. debug      fix-cache-stale        completed   yesterday
3. fan-out    refactor-billing       in_progress 1 hour ago
```

Filter to candidates the user picks. **Default-exclude `in_progress` sessions** unless the user explicitly opts to abandon one — surface a separate confirmation for each.

### Phase 4 — Inspect each candidate

For each candidate session, gather:

```bash
# Worktree path (if any)
git worktree list --porcelain | awk '/^worktree /{wt=$2} /^branch /{print wt, $2}'
# Branch merged into main?
git branch --merged main | grep -E "^[* ] $branch_name$"
# Worktree has uncommitted changes?
( cd "$worktree_path" 2>/dev/null && git status --porcelain | wc -l )
# Branch has unpushed commits?
git log "origin/$branch_name..$branch_name" --oneline 2>/dev/null | wc -l
```

Build a per-session summary:

```
Session: <session-id>
Branch: <branch>
Workspace: .orc/<sanitized-branch>/  (size: <N> files)
Worktree:  <path or "none">           (dirty: <yes|no>)
Branch merged into main? <yes|no>
Unpushed commits? <count>
```

### Phase 5 — Render the cleanup plan + confirm

For every candidate, list exactly what will be done:

```
Will clean up:

[feat-142-notifs]
  ✓ rm -rf .orc/feat-142-notifs/
  ✓ remove from .orc/orc.json
  ✓ git worktree remove ../wt-feat-142-notifs   (clean)
  ✓ git branch -d feat-142-notifs                (merged into main)

[fix-cache-stale]
  ✓ rm -rf .orc/fix-cache-stale/
  ✓ remove from .orc/orc.json
  ⚠ worktree at ../wt-fix-cache-stale has 3 uncommitted files — SKIP worktree removal
  ⚠ branch fix-cache-stale not merged into main — SKIP branch deletion
```

Show the full plan via `AskUserQuestion`:
- "Proceed — apply the plan as shown"
- "Edit plan — pick individual items to skip"
- "Cancel"

If `--dry-run`: print the plan and exit; never apply.

### Phase 6 — Apply (with safety gates)

For each session:

1. **Workspace state** — `rm -rf .orc/<sanitized-branch>/`. Update `.orc/orc.json` to remove the entry (use Read + Write to preserve the JSON).
2. **Worktree** — `git worktree remove <path>` ONLY if clean. If dirty, skip with a warning. Never use `--force` automatically; require an explicit `--force-dirty` flag in a future iteration if needed.
3. **Branch** — `git branch -d <branch>` ONLY if merged into main. If unmerged, skip with a warning. Never use `-D` automatically.
4. **Worktree prune** — after removals: `git worktree prune` to clean up any stale references.

### Phase 7 — Report

Echo a summary:

```
Cleaned up: 2 / 3 candidates

✓ feat-142-notifs (workspace, worktree, branch)
✓ fix-cache-stale (workspace only — worktree had uncommitted changes; branch unmerged)
⊘ refactor-billing (skipped — still in_progress)

Untouched worktrees:
  ../wt-fix-cache-stale  (3 dirty files — review before deleting manually)

Untouched branches:
  fix-cache-stale  (not merged into main — review before `git branch -D <name>`)
```

## Safety rules (all non-negotiable)

- **No `--force` on dirty worktrees.** A worktree with uncommitted changes contains user work. Skip and surface — never delete.
- **No `git branch -D` (capital D).** Only `-d` (lowercase, refuses unmerged branches). The user must use `-D` manually if they really mean it.
- **No deletion when running from inside a candidate.** Refuse and tell the user where to `cd` first.
- **`.orc/orc.json` updates are atomic.** Read, modify in memory, Write the full file. Never partial.
- **`--dry-run` always prints the plan and exits.** Even if the user confirms during the AskUserQuestion before realizing they should have used `--dry-run`, treat the flag as a final gate.

## When to invoke

Most natural:

- After `/orc:ship` opens a PR and the PR merges in GitHub.
- When `/orc:status` shows multiple stale `completed` sessions cluttering the registry.
- After abandoning a feature (mark the session `abandoned` in `.orc/orc.json` first, then run `/orc:cleanup --all-completed` includes abandoned).

## Output

- Updated `.orc/orc.json` (with cleaned entries removed)
- Removed `.orc/<branch>/` directories
- Removed worktrees (where safe)
- Deleted local feature branches (where merged)
- A summary echoed to the user with anything left undone and why
