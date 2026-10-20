<!-- orc:stack-pr/P7 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 7 — Reviewer hint, summary

1. Echo all PR URLs in stack order.
2. Print the reviewer hint below.

```
Stack created. Reviewers should:
  1. Review and approve PR #1 first — stacks merge bottom-up, and each
     merge retargets the next PR's base.
  2. Each subsequent PR includes only its incremental diff.

If you need to update a middle PR, push to its branch — orc will republish children automatically on the next /orc:address.

Backup branch: ${current_branch}-pre-stack-backup (delete with `git branch -D` once you trust the stack).
```
