---
description: "Handle a mid-flight change — new requirement, wrong slice, or a constraint that just arrived — by classifying the blast radius and re-slicing without discarding work already green. Workspace-aware."
argument-hint: "[--impact in-slice|re-slice|re-plan|abandon] [--track quick|standard|deep] \"<what changed>\""
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(orc-workspace-detect:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git status:*)
  - Bash(graphify:*)
  - Bash(jq:*)
  - Bash(date:*)
---

# /orc:correct-course

Something changed after planning. A requirement moved, a slice turned out to be the wrong shape, a constraint surfaced that nobody had at the plan gate.

Until now the options were "iterate at the plan gate" (which loses the ledger's history) or "abort". Neither is right when four slices are already green.

## When NOT to use

- **A bug in code you just wrote** → `/orc:debug`. The plan is fine; the implementation isn't.
- **Reviewer feedback on an open PR** → `/orc:address`.
- **The work is finished and you want to learn from it** → `/orc:retro`.
- **No session exists** → this command needs a live ledger. Just re-plan.

## Arguments

- `"<what changed>"` — required. One or two sentences describing the change.
- `--impact <level>` — pre-answer the classification gate. Use only when the level is genuinely obvious.
- `--track <level>` — force a track change alongside the correction (per `orc:scale-tracks`). This is the path a track escalation takes.

## Phase 0 — Load the session

!`orc-workspace-detect --banner`

Run the session-startup sequence from `orc:state-protocol` — `orc-state current` → bounded `checkpoint.md` → git cross-check → `orc-state slice list`. A correction made against a stale picture of the ledger is worse than no correction.

No `in_progress` session on the current branch → say so and exit.

Print the current position before anything else:

```
Session: feat-csv-export · phase 5/9 · track standard
Slices: 6 total — 3 committed, 1 green, 1 red, 1 pending
```

## Phase 1 — Classify the blast radius

Four levels. Determine the level from the change against the **ledger**, not against the prose plan:

| Level | Meaning | Ledger effect |
|---|---|---|
| **in-slice** | One pending or red slice's acceptance criteria change | Rewrite that slice's `acceptance` / `est_loc`. Nothing else moves. |
| **re-slice** | Remaining work needs a different decomposition | Regenerate pending/red slices; `committed` and `green` slices are preserved untouched. |
| **re-plan** | The approach itself is wrong | Redraft `plan.md`, regenerate the whole ledger, preserve `committed` slices as done-work context. |
| **abandon** | The work should not continue | Mark the session `abandoned`; no ledger rewrite. |

Use `graphify affected` (per `orc:code-discovery`) to check whether the change reaches files already touched by committed slices — that is usually what separates `re-slice` from `re-plan`.

Print `> **⛔ Gate — course change**` (one line: proposed level + the count of slices affected), then `AskUserQuestion` with the four levels, recommendation first and the reasoning in its description.

**This gate always asks.** It is escalation-shaped: the run cannot proceed under an assumption about how much of the user's in-progress work is about to be rewritten.

## Phase 2 — Write the change record

Before touching the ledger, persist `.orc/<branch>/files/course-change-NN.md` (`NN` zero-padded, incrementing):

```markdown
---
recorded: <ISO>
impact: re-slice
track_before: standard
track_after: standard
slices_preserved: [1, 2, 3]
slices_regenerated: [4, 5, 6]
planSha256_before: <sha>
---

# Course change NN — <one-line summary>

## What changed
## Why it did not surface at the plan gate
## What is preserved and why
```

The middle section is the one that matters. A course change that could have been foreseen is a planning-heuristic signal — `orc:retrospective` reads these files, and "why it did not surface" is what makes them useful later.

## Phase 3 — Apply

Per level:

**in-slice** — `orc-state slice set <id>` with the revised fields. If the slice was `red`, it stays red; if `pending`, it stays pending. Never silently reset a slice's status as part of a content edit.

**re-slice** — regenerate the pending/red slices only:
1. Redraft the affected portion via `orc:writing-plans`, respecting the track's slice ceiling (`orc:scale-tracks`).
2. Regenerate `slices.json`. **`committed` and `green` slices carry through untouched** — the existing title-match preservation rule does the work; verify it did rather than assuming.
3. Recompute `planSha256` over the updated plan artifact.
4. Re-run the readiness gate: `orc-state slice verify`.

**re-plan** — full redraft. Committed slices are described in the new plan as *already-shipped context*, not re-planned. The ledger is regenerated whole; committed entries keep their status and sha.

**abandon** — `orc-state status set abandoned`. Leave the worktree and branch alone; `/orc:cleanup` is a separate, explicit decision.

With `--track`, apply the track change first (it changes the slice ceiling that re-slicing must respect), and record it: `orc-state decision set track <level> --provenance asked`. Track rewrite is the one documented exception to write-once decisions — see `orc:scale-tracks`.

## Phase 4 — Verify and hand back

1. `orc-state verify` — the registry and checkpoint mirror must agree after a ledger rewrite.
2. Print the before/after ledger:

```
Slices: 6 → 7
  preserved: 1,2,3 (committed)
  regenerated: 4,5 → 4,5,6,7
  readiness: PASS
```

3. `orc-state phase set <n>` back to the phase the corrected work re-enters — usually 5 (implement), or 3 (plan) after a `re-plan`. Rewrite the resume digest so `/orc:resume` lands in the right place.

Then `AskUserQuestion`: continue implementing now / stop here and pick it up later.

## Output

- `.orc/<branch>/files/course-change-NN.md`
- Rewritten `slices.json` (except `in-slice` and `abandon`), with `planSha256` bumped
- Updated `checkpoint.md` + resume digest
