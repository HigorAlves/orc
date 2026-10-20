---
name: caveman-pr
description: Ultra-compressed, signal-only pull request descriptions
when_to_use: Use when opening a PR or when the user says "write a PR description", "PR body", "draft the PR", or invokes /caveman-pr.
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
- When the *shape* is the point, one small visual beats bullets: a `diff`-sketch of a call tree, component tree, or file tree, pseudocode of the new control flow, or a short mermaid sequence. One visual, never a gallery.

### How tested (mandatory)
- One or two lines. Command run + result. Or a link to QA artifacts.
- Web change: link to `.orc/<branch>/files/qa/steps.md` (or wherever orc's QA evidence lives).
- "Tests: 47 pass, 0 fail." beats "Wrote tests for the new branch and they all pass."
- Evidence tiers: a screenshot or recording (S) when the change is visual and the environment allows it; execution output (A) — the exact test that failed before and passes now, command + result; prose on its own never counts.

### Notes (only if there's something real)
- **Merge danger** — required for anything beyond a trivial fix, one line: `Door: one-way | two-way · Blast radius: <one or two words>`. Two-way doors revert cleanly; one-way doors (migrations, deletions, published API changes, anything a revert won't undo) say what makes them hard to walk back.
- Breaking changes — call out, including the migration step.
- Risks the reviewer must look at twice.
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

## GitHub markdown craft

Terse ≠ plain. Read [GITHUB-MARKDOWN.md](references/GITHUB-MARKDOWN.md) when the body carries evidence bulk, code locations, or callouts — auto-links, permalinks, `<details>`, tables, task lists.

## Examples

Read [EXAMPLES.md](references/EXAMPLES.md) for three shaped bodies — title-only bug fix, feature with Why + QA link, refactor with breaking change + merge-danger line — when unsure how terse the result reads.

## Auto-Clarity

Always include a `## Why` section for: ADR-driven refactors, security fixes, data migrations, breaking changes. Never compress those into title-only — future debuggers need the context.

The Merge-danger line is mandatory for every one-way door: a migration, a deletion, a published API change, a config cutover. A reviewer deciding how carefully to read needs the door and the blast radius before the diff.

For **web changes**, `## How tested` MUST link to the QA artifact directory (per orc's web-QA evidence rule) or explicitly state "no UI surface touched". A bare "tested manually" is not acceptable.

## Boundaries

Only generates the PR description (title + body) as a code block ready to paste into `gh pr create --title ... --body ...` or the GitHub UI. Does NOT:

- open the PR (that's `/orc:ship` or a manual `gh pr create`)
- push commits
- modify the diff
- amend a previous PR

This skill is `/orc:ship`'s **default** body composer (Phase 4); `/orc:ship --verbose` opts out into the long-form template.

## When to revert to verbose

User says "verbose PR", "long-form description", "explain in detail", "this PR needs context" — drop the compression and write a longer description with full reasoning, alternatives considered, risk model, etc. Caveman is the default, not a mandate.
