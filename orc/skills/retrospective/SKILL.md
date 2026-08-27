---
name: retrospective
description: Close the loop from outcome back to rule — read a finished session's evidence (slices, QA verdict, review findings, CI) and convert recurring signal into project-context rules, ADR candidates, and planning calibration. Use after shipping, or when the same mistake has now happened twice.
---

# Retrospective

orc produces more evidence per change than any comparable harness — `slices.json` with estimates against actuals, `qa-verdict.json` scored per acceptance criterion, `review-findings.json`, CI classifications, an append-only `progress.md`. Until now **none of it was ever read back.** Every branch started from the same blank slate as the first.

A retro is the read-back. Its output is not a document — it is **deltas applied to the layers that shape the next session.**

## The rule

> A retro that produces only prose has failed. Every retro either lands at least one delta, or explicitly states that the session was clean and there is nothing to learn.

"Nothing to learn" is a legitimate and common outcome. Manufacturing lessons to look productive poisons the context layer, which is worse than an empty retro.

## Inputs

Read from `.orc/<branch>/files/` — all optional; absent files are skipped silently, not flagged:

| Source | Signal it carries |
|---|---|
| `slices.json` | `est_loc` vs actual diff per slice; escalation count; slices that went `red → green` more than once |
| `qa-verdict.json` | Criteria that failed first pass; criteria that could not be observed |
| `review-findings.json` | Finding categories, and repeats across slices |
| `readiness.json` | CONCERNS that were waived, and whether they later bit |
| CI outcomes | Failure classifications from `orc-ci-investigator` — especially `environment-drift` |
| `progress.md` | The narrative — where time actually went |
| `git log` on the branch | Revert commits, fixup churn, files touched repeatedly |

## The six deltas

Each signal has exactly one destination. Routing is mechanical — the judgment is in *whether* a signal is real, never in where it goes.

| Signal | Delta | Destination |
|---|---|---|
| A convention was corrected in review, and it was not the first time | new rule | `/orc:context add-rule` |
| An architectural decision got made mid-flight and never written down | ADR candidate | `/orc:adr` (its own three-part gate still applies) |
| `est_loc` was off by a consistent factor across ≥3 slices | calibration | `planning-calibration.json` |
| A review-finding category repeats across slices | new rule | context layer → Patterns to avoid |
| An approach was tried and rejected | rejection record | `docs/agents/out-of-scope.md` |
| A slice escalated for a reason the planner could have foreseen | planning heuristic | `orc:writing-plans` note in the retro, surfaced to the user |

### The "twice" threshold

**One occurrence is an incident. Two is a pattern.** Only patterns become rules.

A single review comment about import ordering is noise; the same comment on three slices is a rule. Check `review-findings.json` across the session first, then — when a prior `retro.md` exists in the repo's knowledge layer — across sessions. Promoting one-offs is how a 40-line context file becomes 400 and stops being read.

## Planning calibration

The one delta that is pure arithmetic. `orc:writing-plans` asks planners for `est_loc`; nothing has ever checked it.

Write `planning-calibration.json` at the **context-layer root** — `docs/agents/` when the repo opted in, else `${ORC_STATE_DIR}/` (per-repo, beside `orc.json`, never inside a branch dir). Resolution per `orc:tracker-config`; contract per `orc:project-context`:

```json
{
  "schema": 1,
  "updatedAt": "<ISO>",
  "samples": 14,
  "locFactor": 1.35,
  "byKind": { "feature": 1.4, "bug": 0.9, "refactor": 1.8 },
  "note": "estimates run low on refactors — blast radius is the usual miss"
}
```

- `locFactor` = median(actual ÷ estimated) over the last 20 slices. Never the mean — one runaway slice should not move it.
- Require **≥5 samples** before writing a factor at all. Below that, record `samples` and leave `locFactor` null.
- `orc:writing-plans` multiplies its heuristic by `locFactor` when the file exists and clamps to `[0.5, 2.5]`. A factor outside that range means something other than estimation is wrong — surface it instead of applying it.

## Protocol

1. **Collect.** Read the inputs. Compute the numbers before forming any narrative — a retro that starts from a story finds evidence for the story.
2. **Classify.** For each candidate signal: does it clear the twice threshold, and does it route to exactly one delta? Signals that clear neither go in the retro body as observations and produce no delta.
3. **Draft** `retro.md` — see the shape below.
4. **Gate once.** Print `> **⛔ Gate — retro deltas**` (one line: N deltas proposed), then present each delta as an accept/skip row via `AskUserQuestion`. The user accepts a subset; nothing is applied before this gate.

   This gate asks at **every** autopilot level. Deltas rewrite the layer that directs all future agents in the repo — that is the definition of a decision that stays human.
5. **Apply** the accepted deltas by calling the owning surface (`/orc:context add-rule`, `/orc:adr`, the calibration write). Never hand-edit a file another command owns.
6. **Prune.** Before finishing, check the context layer against its size cap. If a rule has not been relevant across the last several sessions, propose deleting it in the same gate. **The retro is the only surface that removes rules** — without it, the context layer only ever grows.

## `retro.md` shape

```markdown
---
session: <branch>
generated: <ISO>
deltas_proposed: <n>
deltas_applied: <n>
---

# Retro — <deliverable one-liner>

## Numbers
| Metric | Value |
|---|---|
| Slices | 6 (1 escalated) |
| est_loc vs actual | 480 est / 690 actual — factor 1.44 |
| QA criteria | 11/11 pass, 2 needed a second run |
| Review findings | 7 (3 × naming, 2 × error handling, 2 × one-off) |
| CI | 2 red — 1 flake, 1 environment-drift |

## What the evidence says
Three sentences. Facts, not narrative.

## Deltas
| # | Signal | Delta | Destination | Status |
|---|---|---|---|---|
| 1 | naming corrected on 3 slices | rule | context → Patterns to follow | applied |
| 2 | refactor slices ran 1.8× over | calibration | planning-calibration.json | applied |
| 3 | swapped to Result<T,E> mid-flight | ADR candidate | /orc:adr | skipped by user |

## Observations (no delta)
One-offs and things worth remembering that did not clear the twice threshold.
```

## Where retros live

`retro.md` is written to `.orc/<branch>/files/retro.md` — it is session evidence.

Its **deltas** are what persist. Also append a two-line digest (date, deltas applied) to `retro-log.md` at the context-layer root, so cross-session patterns are visible to the next retro — that is what makes the twice threshold work across sessions and not just within one. The log is an index, not a store: it never holds the retros themselves.
