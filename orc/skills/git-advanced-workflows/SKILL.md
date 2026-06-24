---
name: git-advanced-workflows
description: Advanced Git workflows - rebase, cherry-pick, bisect, worktrees, reflog - for clean history and recovery. Use when managing complex histories, collaborating on branches, or troubleshooting a repo.
---

# Git Advanced Workflows

Master advanced Git techniques to maintain clean history, collaborate effectively, and recover from any situation with confidence.

## When to Use This Skill

- Cleaning up commit history before merging
- Applying specific commits across branches
- Finding commits that introduced bugs
- Working on multiple features simultaneously
- Recovering from Git mistakes or lost commits
- Managing complex branch workflows
- Preparing clean PRs for review
- Synchronizing diverged branches

## Which Tool for Which Situation

| Situation | Tool | Reference |
| --- | --- | --- |
| Clean up / squash / reword / reorder / split commits before a PR | Interactive rebase | `references/rebase.md` |
| Update a feature branch with `main`, decide rebase vs merge | Rebase / merge | `references/rebase.md` |
| Apply a single commit (e.g. hotfix) to other branches/releases | Cherry-pick | `references/cherry-pick.md` |
| Apply only specific files from a commit | Partial cherry-pick | `references/cherry-pick.md` |
| Find the commit that introduced a bug | Bisect | `references/bisect.md` |
| Work on multiple branches at once without stashing | Worktrees | `references/worktrees.md` |
| Recover lost commits / deleted branches / undo a bad reset | Reflog & recovery | `references/reflog-recovery.md` |
| Abort an in-progress rebase/merge/cherry-pick/bisect | Recovery commands | `references/reflog-recovery.md` |
| Safety rules before rewriting shared history | Best practices & pitfalls | `references/history-rewrite.md` |

Read the matching `references/*.md` file when you need the detailed commands and worked examples for that situation. Load only the references relevant to the task at hand.

## References

- `references/rebase.md` - interactive rebase operations, clean-up-before-PR workflow, rebase vs merge strategy, autosquash, splitting commits.
- `references/cherry-pick.md` - cherry-picking single commits/ranges, hotfix-to-multiple-releases workflow, partial (per-file) cherry-pick.
- `references/bisect.md` - manual and automated `git bisect` to locate a bug-introducing commit.
- `references/worktrees.md` - managing multiple worktrees for simultaneous multi-branch development.
- `references/reflog-recovery.md` - using reflog to recover lost commits/branches, undo resets, and abort in-progress operations.
- `references/history-rewrite.md` - cross-cutting best practices and common pitfalls when rewriting history (force-with-lease, backups, public branches).
