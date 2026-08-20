---
name: resolving-merge-conflicts
description: "Resolve an in-progress git merge or rebase conflict by tracing each side's intent back to primary sources before touching a hunk; always resolve, never --abort. Use when a merge or rebase stops on conflicts, or when conflict markers appear anywhere in the working tree."
license: MIT
metadata:
  author: Matt Pocock
  source: Vendored from https://github.com/mattpocock/skills @ 2ffb184
---

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, check the PRs, check original issues/tickets.

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off. Do **not** invent new behaviour. Always resolve; never `--abort`.

4. Discover the project's **automated checks** and run them — typically typecheck, then tests, then format. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage everything and commit. If rebasing, continue the rebase process until all commits are rebased.
