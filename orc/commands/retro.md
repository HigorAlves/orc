---
description: "Close the loop after shipping — read the session's evidence (slices, QA verdict, review findings, CI) and apply what it teaches to the project-context layer, ADRs, and planning calibration. Workspace-aware."
argument-hint: "[<branch>] [--dry-run] [--since <n>] [--repos a,b | --repo a | --all-repos | --this-repo]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(orc-workspace-detect:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git status:*)
  - Bash(gh pr view:*)
  - Bash(gh run list:*)
  - Bash(jq:*)
  - Bash(date:*)
---

# /orc:retro

The session is shipped. Everything orc measured while shipping it — estimates against actuals, QA scores, review findings, CI classifications — is sitting in `.orc/<branch>/files/` and has never been read back.

`/orc:retro` reads it and turns the recurring parts into rules the next session inherits.

Protocol, the six deltas, the twice threshold, and the calibration maths live in `orc:retrospective`. **Invoke that skill first.**

## When NOT to use

- **A production incident** → `/orc:postmortem`. That is blameless timeline work with P0 action items filed as tracker issues; this is process calibration.
- **Mid-flight course correction** → `/orc:correct-course`. A retro looks backward at a finished session.
- **A single mistake you already understand** → `/orc:context add-rule` directly. A retro is for finding patterns you have *not* noticed.

## Arguments

- `<branch>` — session to retro. Defaults to the current branch's session; falls back to the most recently `completed` session when the current branch has none.
- `--dry-run` — compute and print the deltas, apply nothing. No gate.
- `--since <n>` — widen the calibration window to the last `n` completed sessions (default: this session only for findings, last 20 slices for calibration).
- `--repos` / `--repo` / `--all-repos` / `--this-repo` — workspace targeting per `orc:workspace-mode`.

## Phase 0 — Detect context + resolve the session

!`orc-workspace-detect --banner`

Resolve the session per `orc:state-protocol` — `orc-state current`, else `orc-state sessions --status completed` and pick the most recent. This is one of the four surfaces permitted to enumerate sessions (`/orc:resume`, `/orc:status`, `/orc:cleanup`, and this one) — the read-for-data exception exists precisely for looking across sessions.

No session found → say so in one line and exit. There is nothing to retro.

## Phase 1 — Collect the evidence

Read every input `orc:retrospective` names, skipping absent files **silently**. Then gather what only lives outside `.orc/`:

- `gh pr view --json reviews,comments` for the session's PR (`prUrl` in the registry entry) — review findings that never made it into `review-findings.json` because they arrived after the local review.
- `gh run list --branch <branch>` — CI red/green history, and how many pushes it took to get green.
- `git log --oneline` on the branch — revert and `fixup!` churn is a signal the slicing was wrong.

Compute the numbers **before** writing a word of narrative.

> **⚠️ Caution**
>
> A retro that starts from a story finds evidence for the story. Numbers first, always — the "What the evidence says" section is written last.

## Phase 2 — Classify

Apply the twice threshold from `orc:retrospective`. For each candidate:

- clears the threshold and routes to exactly one delta → **delta**;
- real but singular → **observation**, recorded in the retro body, no delta;
- neither → dropped, not mentioned.

If nothing clears the threshold, that is the finding. Write the retro, state that the session was clean, propose no deltas, and skip the gate entirely.

## Phase 3 — Draft + gate

Write `.orc/<branch>/files/retro.md` in the shape `orc:retrospective` specifies.

Print `> **⛔ Gate — retro deltas**` (one line: N deltas proposed, M prunes), then `AskUserQuestion` with one row per delta — accept / skip. Include prune proposals for context rules that have gone stale.

**This gate asks at every autopilot level.** Deltas rewrite the layer that directs every future agent in the repo. `--auto` does not touch it.

`--dry-run` stops here, having written nothing.

## Phase 4 — Apply

Call the owning surface for each accepted delta — never hand-edit a file another command owns:

| Delta | Call |
|---|---|
| new rule | `/orc:context add-rule "<text>" --section <name>` |
| ADR candidate | `/orc:adr` (its three-part gate still applies — a retro can propose, not decide) |
| calibration | write `planning-calibration.json` per `orc:retrospective` |
| rejection record | append to `docs/agents/out-of-scope.md` |
| prune | `/orc:context` refresh path, removing the named rules |

Then append the two-line digest to `retro-log.md` at the context-layer root (`docs/agents/` or `${ORC_STATE_DIR}/`, resolved per `orc:tracker-config`).

## Phase 5 — Report

```
✓ Retro — feat-csv-export
  6 slices (1 escalated) · est 480 / actual 690 · QA 11/11 · CI 2 red (1 flake)
  3 deltas proposed, 2 applied:
    → context rule: "route handlers need a manifest.ts entry"
    → calibration: locFactor 1.35 → 1.44 (refactor 1.8)
  1 skipped: ADR candidate (Result<T,E> boundary)
```

## Wiring

`/orc:flow` offers `/orc:retro` at Phase 9 (cleanup), **before** the state directory is removed — `.orc/<branch>/files/` is the input, so retro-then-cleanup is the only workable order. Declining is one keystroke and the flow continues.

Standalone use is the other half: run it after a PR merges, or when the same review comment has now shown up for the third time.
