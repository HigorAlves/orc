# Reflog & Recovery

Reflog is your safety net - it tracks all ref movements, even deleted commits, for ~90 days.

```bash
# View reflog
git reflog

# View reflog for specific branch
git reflog show feature/branch

# Restore deleted commit
git reflog
# Find commit hash
git checkout abc123
git branch recovered-branch

# Restore deleted branch
git reflog
git branch deleted-branch abc123
```

## Workflow: Recover from Mistakes

```bash
# Accidentally reset to wrong commit
git reset --hard HEAD~5  # Oh no!

# Use reflog to find lost commits
git reflog
# Output shows:
# abc123 HEAD@{0}: reset: moving to HEAD~5
# def456 HEAD@{1}: commit: my important changes

# Recover lost commits
git reset --hard def456

# Or create branch from lost commit
git branch recovery def456
```

## Recovery Commands

```bash
# Abort operations in progress
git rebase --abort
git merge --abort
git cherry-pick --abort
git bisect reset

# Restore file to version from specific commit
git restore --source=abc123 path/to/file

# Undo last commit but keep changes
git reset --soft HEAD^

# Undo last commit and discard changes
git reset --hard HEAD^

# Recover deleted branch (within 90 days)
git reflog
git branch recovered-branch abc123
```
