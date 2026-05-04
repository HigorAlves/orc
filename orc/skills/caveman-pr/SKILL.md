---
name: caveman-pr
description: >
  Ultra-compressed pull request descriptions. Same family as caveman-commit
  and caveman-review — terse, signal-only PR body. Use when opening a PR
  (via /orc:ship or gh pr create), when user says "write a PR description",
  "PR body", "draft the PR", or invokes /caveman-pr. Skips boilerplate the
  reviewer can read from the diff.
---

Write PR descriptions terse and exact. Reviewers don't need a tour of your diff — they need a *why*, a *how-tested*, and (if relevant) a heads-up.

## Rules

**Title:**

- Same shape as the squash-merge commit subject — Conventional Commits if the project uses them (`feat(scope): ...`, `fix(scope): ...`).
- ≤ 72 chars; ≤ 50 if possible.
- Imperative mood ("add", "fix", "remove" — not "added").
- No `[WIP]` — use a draft PR instead.
- No emoji unless the project already does it.

**Body — at most 4 sections, in this order. Omit any that don't add signal.**

### Why (almost always mandatory)
- 1–3 sentences. Link the plan / RFC / ADR / Jira ticket / issue if that's the why.
- Skip ONLY when the title is genuinely self-explanatory (e.g. `fix(billing): guard against zero-cap users` — title says everything).

### What changed (often skippable)
- ONLY include if the diff isn't obvious from a 30-second skim.
- Bullets of structural changes. Don't restate file paths the reviewer will see anyway.
- Drop "Refactored", "Cleaned up" — say what *behavior* changed.

### How tested (mandatory)
- One or two lines. Command run + result. Or a link to QA artifacts.
- Web change: link to `.orc/<branch>/files/qa/steps.md` (or wherever orc's QA evidence lives).
- "Tests: 47 pass, 0 fail." beats "Wrote tests for the new branch and they all pass."

### Notes (only if there's something real)
- Breaking changes — call out, including the migration step.
- Risks the reviewer should look at twice.
- Follow-up issues filed.
- Skip platitudes ("clean code", "all tests pass" — already covered).

### Trailers (footer, not a section)
- `Closes #42`, `Refs #17`, `Fixes ENG-712` — one per line at the very bottom.
- No AI attribution. No `Co-Authored-By: Claude`. No `Generated with…`.

## What NEVER goes in

- "This PR does X" — the title and diff already say it.
- "Please review carefully" / "Let me know what you think" — reviewer knows their job.
- Line-by-line restatement of the diff.
- Marketing voice ("This game-changing refactor unlocks…").
- Emoji-stuffed checklists if the repo's PR template doesn't require them.
- AI attribution of any kind.
- A "Screenshots" section with placeholder text — either include real screenshots/links or omit.

## Examples

### Bug fix — title is self-explanatory, no Why section

```
fix(billing): guard against zero-cap users in usage display

## How tested
Tests: 142 pass. Manual: opened /billing as a free-tier user with cap=0,
output now reads "$0 of $0" (was "$NaN of $undefined").

Closes #482
```

### Feature — Why required, links plan + QA

```
feat(reports): add CSV export

## Why
Customer-requested in support tickets #311, #389, #412. Plan at
.orc/feat-csv-export/files/plan.md.

## How tested
Tests: 47 pass. Browser QA: .orc/feat-csv-export/files/qa/steps.md
(golden path, empty report, 1k-row report, permission-denied).

Closes #311
```

### Refactor with breaking change + risk

```
refactor(auth): replace JWT validation with opaque session lookup

## Why
ADR-0007 — compliance flagged JWT non-revocability after incident #142.

## What changed
- Authenticated middleware now hits Redis on every request instead of
  parsing the JWT in-process.
- Old JWT path remains for 30 days, flag-gated by USE_OPAQUE_SESSIONS.

## How tested
Tests: 312 pass. Staging load test: p99 latency +3ms (within budget).

## Notes
- Hard dependency on session service availability — outage = no auth.
  Runbook update in #318.
- Breaking change at end of 30-day window; tracked via #319.

Closes ENG-712
```

## Auto-Clarity

Always include a `## Why` section for: ADR-driven refactors, security fixes, data migrations, breaking changes. Never compress those into title-only — future debuggers need the context.

For **web changes**, `## How tested` MUST link to the QA artifact directory (per orc's web-QA evidence rule) or explicitly state "no UI surface touched". A bare "tested manually" is not acceptable.

## Boundaries

Only generates the PR description (title + body) as a code block ready to paste into `gh pr create --title ... --body ...` or the GitHub UI. Does NOT:

- open the PR (that's `/orc:ship` or a manual `gh pr create`)
- push commits
- modify the diff
- amend a previous PR

Composes well with `/orc:ship` Phase 4 (PR composition) — `/orc:ship --caveman` invokes this skill for the body.

## When to revert to verbose

User says "verbose PR", "long-form description", "explain in detail", "this PR needs context" — drop the compression and write a longer description with full reasoning, alternatives considered, risk model, etc. Caveman is the default, not a mandate.
