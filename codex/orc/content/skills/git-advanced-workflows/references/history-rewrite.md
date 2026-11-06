# History Rewrite: Best Practices & Pitfalls

Cross-cutting guidance for any operation that rewrites Git history (rebase, amend, force push, filter). For the mechanics of a specific operation see `rebase.md`, `cherry-pick.md`, etc.

## Best Practices

1. **Always Use --force-with-lease**: Safer than --force, prevents overwriting others' work
2. **Rebase Only Local Commits**: Don't rebase commits that have been pushed and shared
3. **Descriptive Commit Messages**: Future you will thank present you
4. **Atomic Commits**: Each commit should be a single logical change
5. **Test Before Force Push**: Ensure history rewrite didn't break anything
6. **Keep Reflog Aware**: Remember reflog is your safety net for 90 days
7. **Branch Before Risky Operations**: Create backup branch before complex rebases

```bash
# Safe force push
git push --force-with-lease origin feature/branch

# Create backup before risky operation
git branch backup-branch
git rebase -i main
# If something goes wrong
git reset --hard backup-branch
```

## Common Pitfalls

- **Rebasing Public Branches**: Causes history conflicts for collaborators
- **Force Pushing Without Lease**: Can overwrite teammate's work
- **Losing Work in Rebase**: Resolve conflicts carefully, test after rebase
- **Forgetting Worktree Cleanup**: Orphaned worktrees consume disk space
- **Not Backing Up Before Experiment**: Always create safety branch
- **Bisect on Dirty Working Directory**: Commit or stash before bisecting
