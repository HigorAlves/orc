<!-- orc:cleanup/P6 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 6 — Apply with safety gates

> **⚠️ Caution**
>
> - The state file holds the teardown command: remove the Docker environment before the state, or the environment is orphaned.
> - A dirty worktree holds user work. A reused PID belongs to someone else.

For each session, in order:

1. Run the state file's `teardownCommand`; append `-v` only with `--down-volumes`.
2. For each recorded `hostProcesses[]` PID, verify via `ps` that it still runs the recorded command.
3. Kill a verified PID; report a reused PID, never kill it.
4. Run `rm -rf .orc/<sanitized-branch>/`.
5. Remove the entry from `.orc/orc.json` with Read + Write; keep the JSON intact.
6. If the worktree is clean, run `git worktree remove <path>`.
7. If it is dirty, skip it and print `**⚠️ Skipped — dirty worktree**`.
8. If main contains the branch, run `git branch -d <branch>`.
9. If the branch is unmerged, skip it and print `**⚠️ Skipped — unmerged branch**`.
10. After the removals, run `git worktree prune`.
11. For stack members, iterate parents first and apply the gate below (bash).
12. In workspace mode, repeat steps 4–10 per repo in `repos` (list below).

Never pass `--force` to `git worktree remove`; never run `git branch -D`. A future `--force-dirty` flag is the only sanctioned path for dirty worktrees.

Stack gate, ordered by `stackPosition` ascending (parents first); refuse any branch whose parent (position N-1) is still `OPEN`:

```bash
# stack ordered by stackPosition asc (parents first)
for member in "${stack_members[@]}"; do
  parent_state=$([ "$pos" -eq 1 ] && echo "MERGED" || gh_state "$parent_url")
  child_state=$(gh_state "$member_url")
  if [ "$child_state" = "MERGED" ] && [ "$parent_state" = "MERGED" ]; then
    git branch -d "$member_branch"
  else
    echo "Keep $member_branch — child=$child_state parent=$parent_state"
  fi
done
```

NOTE: `--per-repo` is the escape hatch for "child merged out of order": it bypasses the parent-merged check and deletes the child branch anyway. Use it only when abandoning the unmerged parent.

Workspace-mode sessions:

- For each repo `r`: `cd "$ORC_WORKSPACE_ROOT/$r"`, then `rm -rf .orc/<branch>/` (per-repo state, including the `workspace-link.json` back-pointer), `git worktree remove <perRepoState[$r].worktree>` (clean), `git branch -d <perRepoState[$r].branch>` (merged), `git worktree prune`.
- Then the workspace-level state: `rm -rf $ORC_WORKSPACE_ROOT/.orc/<branch>/` and remove the session entry from `$ORC_STATE_DIR/orc.json`.
- With `--per-repo`: touch only repos whose PR is `MERGED`; leave the others' state intact; update the workspace registry for the partial cleanup (`perRepoState[$r]` removed, `repos` array trimmed).
