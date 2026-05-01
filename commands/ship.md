---
description: Finalize and open the PR. Verifies tests pass, presents structured commit/branch/PR options, executes the chosen path. Last command before review.
argument-hint: "[--draft] [--base <branch>] [--caveman]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git *)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(gh pr list:*)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
---

# /orc:ship

You're done implementing. Time to integrate. This command runs the structured branch-completion flow.

## Arguments

- `--draft` — open the PR as a draft.
- `--base <branch>` — target a non-default base (e.g. `develop`, `release/v2`).
- `--caveman` — compose the PR title and body using `orc:caveman-pr` (terse, signal-only). Default is the verbose template documented in Phase 4.

## Workflow

### Phase 1 — Pre-ship verification

Invoke `orc:verification-before-completion`. Confirm:
- Tests pass.
- Lint / type-check pass (if configured).
- No staged-but-uncommitted changes (`git status --porcelain`).
- Current branch is NOT a protected branch.

If any check fails, stop and show the failure. Do not proceed.

### Phase 2 — Self-request a review

Invoke `orc:requesting-code-review`. The skill walks through whether the work meets requirements and is review-ready. If the skill flags gaps, surface them; user decides whether to proceed.

### Phase 3 — Branch completion options

Invoke `orc:finishing-a-development-branch`. The skill presents structured options via `AskUserQuestion` (typically: open PR / merge directly / keep working / discard). Execute the chosen option.

If the user picks "open PR":

### Phase 4 — Compose PR

Invoke `orc:git-commit` if there are uncommitted changes. Then:

1. Determine PR title from the branch name + recent commit subjects.
2. Compose the body. Two modes:
   - **Default (verbose)** — sections: **What** (one-paragraph summary), **Why** (link to plan / issue / PRD if available; `.orc/<branch>/files/plan.md` if present), **How tested** (test commands run; browser QA artifacts if web change at `.orc/<branch>/files/qa/`), **Checklist** (boxes for the reviewer).
   - **`--caveman` mode** — invoke `orc:caveman-pr` and follow it exactly. Skips the verbose template; returns a tight title + body with only the sections that add signal (Why / What changed / How tested / Notes / trailers). Best when the diff is small or the PR template is heavyweight.
3. Show the user the title + body via `AskUserQuestion`: `Open as-is` / `Edit first` / `Cancel`.

### Phase 5 — Push + create PR

```
git push -u origin <branch>
gh pr create --title "<title>" --body "<body>" [--draft] [--base <base>]
```

Echo the PR URL.

### Phase 6 — Cleanup hint

If the user opted for "merge after CI" rather than "wait for review," surface a reminder to come back with `/orc:address` if reviewers leave comments.

After the PR merges in GitHub, the user should run **`/orc:cleanup`** to remove the `.orc/<branch>/` workspace state, the associated git worktree (if `using-git-worktrees` was used), and the local feature branch (if it merged cleanly). Surface this hint as the last line of `/orc:ship`'s output so the lifecycle closes properly.

## Output

- A new (or updated) PR on GitHub
- PR URL echoed to the user
- (No `.orc/` writes — `/orc:ship` doesn't checkpoint; integration is the terminal state.)
