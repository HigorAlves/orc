# Stacked PRs — reviewer convention

orc opens stacks of small PRs when a single change exceeds the per-PR LOC budget (default 300). This page is the contract reviewers and authors share so the stack works for everyone.

## Why stacks

A 600-LOC PR gets a worse review than three 200-LOC PRs. Reviewers context-switch less, can approve incrementally, and the author can make progress on the bottom of the stack while the top is still in review. The cost is one ritual: **stacks merge bottom-up.**

## How to read a stacked PR

Every PR in a stack carries a `## Stacked PR (i/N)` block in its body. Example from PR #312 in a 3-stack:

```
## Stacked PR (2/3)

Stack: feat-export-2026-05-15
Merge bottom-up. See docs/STACKED-PRS.md.

| # | Subject                                      | PR          | Status |
|---|----------------------------------------------|-------------|--------|
| 1 | refactor: extract row-stream interface       | acme/api#311 | parent |
| 2 | feat(api): wire export job through stream    | acme/api#312 | this   |
| 3 | feat(ui): download button + progress         | acme/ui#447  | child  |
```

You're looking at PR 2. Its base branch is **PR 1's branch**, not `main`. Its diff shows only the *incremental* change on top of PR 1. If you also want to see PR 1's changes, `gh pr diff 311`.

## Merge order rule (bottom-up)

Approve and merge **PR 1 first**. Once it's merged into `main`:

- The orc tooling (or `gh-stack`) will rebase PRs 2 and 3 onto `main` (or onto each other), republishing their branches. Their diffs become smaller — the lines that were "in PR 1" are now in `main`.
- PR 2 becomes the new bottom. Approve and merge it next.
- Then PR 3.

If you merge PR 3 first while PR 1 is still open, you orphan the stack. The orc cleanup gate refuses to delete child branches whose parents haven't merged for this reason.

## Reviewing one PR at a time

You're approving PR `i`'s incremental change, not the whole feature. Comment on what's in **this** PR's diff:

- Don't write "where is the X?" if X lives in PR i+2 — note it on PR i+2 instead.
- Don't write "this duplicates Y" if Y lives in PR i-1 — that's the deduplicated version about to land.
- DO write "this PR's API doesn't match the PRD" — that's the right level.

If you genuinely can't review PR `i` in isolation (it imports a symbol you can't see, references a config that hasn't been added yet) — comment on PR `i`'s body asking for that context, OR pull PR `i`'s branch locally to see the full picture.

## Approvals are per-PR

GitHub records an approval per PR. Approving PR 1 does not approve PR 2 or 3. This is a feature: it lets you stop the train at any point.

If you want to signal "I've read all 3 and they look good as a unit" — comment that on PR 1 (the root). Then explicitly approve each PR.

## What happens when a middle PR needs changes

Author pushes a fix to PR 2. Two things happen automatically (via orc tooling, `gh-stack`, or manually):

1. PR 2's branch is updated.
2. PR 3's branch is rebased onto the new tip of PR 2 and force-pushed.

PR 3 will show "force-pushed" in its event log. Existing approvals on PR 3 remain unless the rebase caused conflicts that required code edits — in which case `gh` typically dismisses the stale approval and re-review is needed.

If you're a reviewer mid-pass on PR 3 and the rebase happens, you may need to re-pull. Use `gh pr checkout 447 --force` to overwrite local state.

## When stacks are NOT used

orc's size-gate offers an explicit "open big with reason" path. PRs you receive with a `Size-budget-override:` trailer in the body are deliberate single-PRs over the budget — typically auto-generated migrations, vendored libraries, or production hot-fixes. The trailer carries the author's one-line reason; the rest of the review is normal.

Any time you see no `## Stacked PR` block and no `Size-budget-override:` trailer on a PR over 300 LOC — that's a process miss. Flag it on the PR.

## Quick reference

| Situation | Do |
|---|---|
| Approving PR 1 of N | Read it on its own merits; merge when satisfied. |
| Reviewing PR 2 of N | Read PR 2's diff alone; ignore lines you'd see in PR 1 or PR 3+. |
| PR 3 of N got force-pushed | Re-pull (`gh pr checkout <N> --force`); re-review the new diff. |
| Need to comment on cross-cutting concern | Comment on the **root** PR (position 1). Authors aggregate from there. |
| Spotting a `Size-budget-override:` trailer | Read it; if the reason is shaky, push back. |

## Author shortcuts

- Stack a too-big branch: `/orc:stack-pr` (commit-based) or `/orc:stack-pr --smart` (analyzer-driven).
- Override the size gate this once: pick "open big with reason" at the `/orc:ship` prompt, supply a one-line rationale.
- Check the budget without shipping: `. orc/lib/pr-size-budget.sh && orc_pr_loc origin/main`.
