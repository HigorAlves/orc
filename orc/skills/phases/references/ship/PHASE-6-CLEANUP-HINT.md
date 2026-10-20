<!-- orc:ship/P6 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 6 — Cleanup hint

1. If the user chose "merge after CI" over "wait for review", print the `/orc:address` reminder.
2. Print the Next block below as the last block of the output.

`/orc:address` reminder: come back with `/orc:address` if reviewers leave comments.

```markdown
> **➡️ Next**
>
> After the PR merges, run `/orc:cleanup` to remove the `.orc/<branch>/` state, the worktree, and the merged branch.
```

NOTE: after the PR merges in GitHub, `/orc:cleanup` removes the `.orc/<branch>/` workspace state, the git worktree (when `orc:using-git-worktrees` created one), and the local feature branch (when it merged cleanly). The hint closes the lifecycle.
