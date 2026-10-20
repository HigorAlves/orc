<!-- orc:cleanup/P7 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 7 — Report

1. Print the summary below as a plain fenced block; reports stay plain, no callout.

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
