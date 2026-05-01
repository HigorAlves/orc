# 00 — End-to-end with `/orc:flow`

## Scenario

You want orc to drive the whole feature lifecycle interactively. One command, `AskUserQuestion` gates at every phase, resumable across days.

## The single command

```
/orc:flow "add CSV export to reports page"
```

That's it. orc walks the rest with you.

## The full session — what you'll see

### Day 1 — morning

```
You: /orc:flow "add CSV export to reports page"

orc: ⚙ Phase 1 — Triage
     What kind of work?
     ┌───────────────────────────────────────────────────┐
     │ ◉ feature                                          │
     │ ○ bug                                              │
     │ ○ refactor                                         │
     │ ○ docs                                             │
     │ ○ something else / let me describe                 │
     └───────────────────────────────────────────────────┘

You: feature

orc: Scope?
     ┌───────────────────────────────────────────────────┐
     │ ○ < 1 day                                          │
     │ ◉ 1–5 days                                         │
     │ ○ 1–4 weeks (recommend --rfc)                      │
     │ ○ multi-quarter (too big — break down first)       │
     └───────────────────────────────────────────────────┘

You: 1–5 days

orc: ⚙ Phase 1 done. Initialized .orc/feat-csv-export/files/.
     ⚙ Phase 2 (RFC) — skipped (scope < 1 week, no --rfc).
     ⚙ Phase 3 — Plan
     [invokes orc:writing-plans, drafts plan to .orc/feat-csv-export/files/plan.md]
     [shows you the plan: 4 vertical slices, 3 parallel-safe]

     Plan looks good?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Yes — proceed                                    │
     │ ○ Iterate on the plan                              │
     │ ○ Add --grill stress-test                          │
     │ ○ Decompose into issues (orc:to-issues)            │
     │ ○ Abort                                            │
     └───────────────────────────────────────────────────┘

You: Yes — proceed

orc: ⚙ Phase 4 — Start
     [invokes orc:using-git-worktrees → ~/wt/orc/feat-csv-export]
     [invokes orc:tdd → writes failing test for slice 1]
     [runs the test → fails with "Cannot find module '../export/csv'"]
     [commits the failing test on branch feat/csv-export]

     Failing test ready. Test:
       src/reports/__tests__/export.test.ts:14 — "exports report rows to CSV"
       Failure: ENOENT — module './export/csv' not found.

     Continue?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Test fails as expected — ready to implement      │
     │ ○ Failure isn't right — iterate                    │
     │ ○ Skip TDD (with rationale)                        │
     │ ○ Abort                                            │
     └───────────────────────────────────────────────────┘

You: Test fails as expected

orc: ✋ Phase 5 — Implementation. orc paused.

     Worktree: ~/wt/orc/feat-csv-export
     Failing test: src/reports/__tests__/export.test.ts:14
     Plan: .orc/feat-csv-export/files/plan.md (4 slices, slice 1 active)

     When you're done implementing, re-run /orc:flow (or /orc:resume).
     The PreToolUse hook will keep you off main — commit per slice
     using orc:git-commit.

You: (close laptop, go to lunch)
```

### Day 1 — afternoon

You implement. You and Claude have a normal coding conversation in the chat. You write the CSV export module, you watch the test go green, you write the next slice's test, etc. orc isn't actively driving — but the iron rules are still active (no commits to main, evidence before claims, etc.) because the SessionStart hook is still in effect.

You commit four times (one per slice, Conventional Commits). All four tests pass.

### Day 2 — morning

```
You: /orc:flow

orc: 📍 Resuming flow for feat-csv-export from .orc/orc.json
     Last completed phase: 5 (implementation)
     Next: Phase 6 — QA

     Diff scan: 3 .tsx files changed → web mode auto-detected.
     Continue?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Yes — run full QA (tests + lint + types + browser)│
     │ ○ Code-only mode (skip browser — only if no UI)    │
     │ ○ Pause flow (come back later)                     │
     └───────────────────────────────────────────────────┘

You: Yes

orc: ⚙ Phase 6 — QA
     [tests] 47 pass, 0 fail.
     [lint] 0 errors, 0 warnings.
     [types] 0 errors.
     [self-review via orc:caveman-review] no findings.
     [orc-qa-validator dispatched, drives agent-browser at localhost:3000]
     [walks golden path + 3 edge cases, captures evidence]

     QA verdict: PASS
     Artifacts: .orc/feat-csv-export/files/qa/
       - 7 screenshots (annotated)
       - snapshot-final.txt
       - console.log (0 errors / 1 warning)
       - network.har
       - steps.md

     Proceed to ship?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Yes — ship it                                    │
     │ ○ I want to address something first (back to phase 5)│
     │ ○ Pause flow                                       │
     └───────────────────────────────────────────────────┘

You: Yes

orc: ⚙ Phase 7 — Ship
     [orc:requesting-code-review → no gaps vs plan]
     [orc:finishing-a-development-branch → option: open PR]
     [composes PR via caveman-pr (because --caveman was passed earlier)]

     PR title: feat(reports): add CSV export
     PR body:

       ## Why
       Customer-requested in support tickets #311, #389, #412.
       Plan in .orc/feat-csv-export/files/plan.md.

       ## How tested
       Tests: 47 pass. QA: .orc/feat-csv-export/files/qa/steps.md.

       Closes #311

     Open?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Open as-is                                       │
     │ ○ Edit title/body first                            │
     │ ○ Open as draft                                    │
     │ ○ Cancel                                           │
     └───────────────────────────────────────────────────┘

You: Open as-is

orc: ⚙ git push -u origin feat/csv-export
     ⚙ gh pr create --title "feat(reports): add CSV export" --body ...
     ✓ PR opened: https://github.com/you/repo/pull/523

     ⚙ Phase 8 — Address
     PR is open. Waiting for reviewer comments?
     ┌───────────────────────────────────────────────────┐
     │ ○ Wait — orc keeps the flow open                   │
     │ ◉ I'll come back later with /orc:flow              │
     │ ○ Done for this PR (skip cleanup readiness)        │
     └───────────────────────────────────────────────────┘

You: I'll come back later
```

### Day 2 — afternoon

Reviewers leave 4 comments overnight.

```
You: /orc:flow

orc: 📍 Resuming flow for feat-csv-export.
     PR #523: 4 unresolved review comments detected.
     Run address loop?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Yes — categorize and fix                         │
     │ ○ Skip — I'll respond manually                     │
     └───────────────────────────────────────────────────┘

You: Yes

orc: ⚙ Phase 8 (loop) — Address
     [fetches comments via gh api, categorizes]
     ACTION: 2  QUESTION: 1  NITPICK: 1  DISAGREE: 0

     Categories look right?
     [...you confirm or re-categorize...]

     [dispatches orc-code-fixer + orc-reply-drafter in parallel]
     [shows you the diff + drafted replies]

     Looks good?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Commit, push, post replies                       │
     │ ○ Edit replies                                     │
     │ ○ Edit fix                                         │
     └───────────────────────────────────────────────────┘

You: Commit, push, post replies

orc: ✓ Pushed fix abc1234, posted 4 replies, re-requested review.

     Wait for the next review round?
     ┌───────────────────────────────────────────────────┐
     │ ○ Wait                                             │
     │ ◉ I'll come back when it's merged                  │
     └───────────────────────────────────────────────────┘
```

### Day 3 — afternoon (PR merged)

```
You: /orc:flow

orc: 📍 Resuming. PR #523 status: MERGED at 2026-05-03T14:22Z.
     ⚙ Phase 9 — Cleanup

     Plan:
     ✓ rm -rf .orc/feat-csv-export/
     ✓ git worktree remove ~/wt/orc/feat-csv-export   (clean)
     ✓ git branch -d feat/csv-export                   (merged into main)

     Apply?
     ┌───────────────────────────────────────────────────┐
     │ ◉ Apply as shown                                   │
     │ ○ Edit (skip individual items)                     │
     │ ○ Skip cleanup (keep state for reference)          │
     └───────────────────────────────────────────────────┘

You: Apply

orc: ✓ Worktree removed.
     ✓ Branch deleted.
     ✓ .orc/feat-csv-export/ removed.
     ✓ Registry updated (status: completed).

     ✓ Flow complete: feat-csv-export
       - plan.md         (4 slices, all green)
       - qa/             (7 screenshots, console.log, network.har, steps.md)
       - PR              (#523, merged 2026-05-03)
       - cleanup         (worktree gone, branch gone, .orc/ cleared)

     Total active time: ~1.2 days
     Active orc sessions remaining: 0
```

## What you noticed

- **Every phase asks before advancing.** No silent transitions. The select-from-list comes from `AskUserQuestion`.
- **The flow paused for implementation.** orc doesn't write your business logic. It sets up the gate (failing test) and gets out of the way until you run `/orc:flow` again or `/orc:resume`.
- **Resume is automatic.** You don't pass any args on the second/third invocation — orc reads `.orc/orc.json`, finds the in-progress flow, jumps to the next pending phase.
- **The PR description was synthesized from accumulated evidence**: plan.md (Why), the diff (What changed), qa/steps.md (How tested), and ticket links.

## Variants

- **Bug instead of feature** — phase 3 becomes `/orc:debug`. The diagnosis substitutes for the plan.
- **Multi-week effort** — pass `--rfc` (or pick "1–4 weeks" in triage) to insert phase 2 (RFC drafting) before planning. The RFC produces alternatives and a decision deadline before any code is touched.
- **Docs only** — pass `--type=docs`. Phases 4 (TDD start) and 5 (implementation) collapse into a docs-writing conversation; phase 6 runs lint only.
- **Verbose PR** — drop `--caveman`. Phase 7 uses the default verbose template with What/Why/How tested/Checklist sections.
- **You don't want orc waiting between phases** — you can always invoke the per-phase commands directly (`/orc:plan`, `/orc:debug`, etc.) for fine-grained control.

## Iron rules in play

- **Every gate is a real gate.** `/orc:flow` never silently advances.
- **Phase state is durable.** Crash mid-flow, resume tomorrow.
- **Per-phase rules still apply** — web QA evidence, blameless framing, no AI attribution, no commits to main. `/orc:flow` doesn't bypass them; it composes them.
- **Implementation isn't automated.** orc holds the discipline; you (and Claude in conversation) write the code.
