# Cherry-Picking

Apply specific commits from one branch to another without merging entire branches.

```bash
# Cherry-pick single commit
git cherry-pick abc123

# Cherry-pick range of commits (exclusive start)
git cherry-pick abc123..def456

# Cherry-pick without committing (stage changes only)
git cherry-pick -n abc123

# Cherry-pick and edit commit message
git cherry-pick -e abc123
```

## Workflow: Apply Hotfix to Multiple Releases

```bash
# Create fix on main
git checkout main
git commit -m "fix: critical security patch"

# Apply to release branches
git checkout release/2.0
git cherry-pick abc123

git checkout release/1.9
git cherry-pick abc123

# Handle conflicts if they arise
git cherry-pick --continue
# or
git cherry-pick --abort
```

## Partial Cherry-Pick

Cherry-pick only specific files from a commit.

```bash
# Show files in commit
git show --name-only abc123

# Checkout specific files from commit
git checkout abc123 -- path/to/file1.py path/to/file2.py

# Stage and commit
git commit -m "cherry-pick: apply specific changes from abc123"
```
