---
description: Plan a feature or refactor — produces a TDD-shaped plan, optionally design-grilled, and decomposes it into independently shippable issues. --jira <KEY> links a ticket. Workspace-aware.
argument-hint: "[--auto[=guided|full]] [--grill] [--issues] [--jira <KEY>] [--repos a,b | --repo a | --all-repos | --this-repo] <feature description>"
effort: high
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(date:*)
  - Bash(git rev-parse:*)
  - Bash(git branch --show-current:*)
  - Bash(jq:*)
  - Bash(graphify:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:plan

Turn a feature or refactor request into a written, TDD-shaped plan at `.orc/<branch>/files/plan.md`, so the work can pause and resume.

## Arguments

- `--auto[=guided|full]` — autopilot level for this run (overrides `interaction_policy`); ladder and hard-outward exemption in `orc:gates` §6.
- `--grill` — after the draft, invoke `orc:grilling` to stress-test the design before committing.
- `--issues` — after approval, run `orc:to-issues` to break the plan into independently grabbable issues.
- `--jira <KEY>` — link a Jira ticket (e.g. `PROJ-123`) silently; suppresses the P1 link prompt.
- `--repos <list>`, `--repo <name>`, `--all-repos`, `--this-repo` — workspace-mode repo selection; precedence per `orc:workspace-mode`.
- The feature description is the rest of the argument string.

## Preconditions

> **🛑 Outward write**
>
> P5 (`--issues`) creates issues on the project tracker through `orc:to-issues`.

- `--jira <KEY>` must match `^[A-Z][A-Z0-9_]*-\d+$`; a mismatch stops the run in P1.
- Brief-shaped and refactor-shaped input are exclusive: one pre-phase runs, never both.
- The plan gate (P4) asks at every autopilot level when `/orc:plan` runs standalone.

## Phases

Modules live in `orc:phases` (`references/plan/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| PRD-shaped input | `orc:plan/PRD` | input is short and clear, or refactor-shaped |
| Refactor-shaped input | `orc:plan/REFACTOR` | input is not refactor-shaped |
| 1 Initialize workspace | `orc:plan/P1` | never |
| 1b Prime code discovery | `orc:plan/DISCOVERY` | `graphify` absent (skip silently) |
| 2 Draft the plan | `orc:plan/P2` | never |
| 3 Stress-test the design | `orc:plan/P3` | no `--grill` |
| 4 Confirm, install the slice ledger | `orc:plan/P4` | never |
| 5 Decompose into issues | `orc:plan/P5` | no `--issues` |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; `ORC_*` vars are exported. Do not re-run detection.
2. In workspace mode, resolve `targetRepos` from the repo flags or via `AskUserQuestion`.
3. If the input is brief-shaped, Read `orc:plan/PRD` and run it before P1.
4. If the input is refactor-shaped, Read `orc:plan/REFACTOR` and run it before P1.
5. Otherwise go straight to P1.

Brief-shaped: long-form text, a Jira ticket or linked doc, or a brief rather than a settled spec. Refactor-shaped: the user asks to refactor, restructure, pay down tech debt or improve architecture, or `--type=refactor` arrived from `/orc:flow`.

NOTE: the workspace prompt has the same shape as `/orc:flow` Phase 1. Iron rule: no silent broadcast.

## Iron rules

- No silent broadcast in workspace mode: every target repo is an explicit choice.
- Every slice carries `est_loc: <int>`; over `${ORC_PR_LOC_BUDGET:-300}`, split it or mark `ships_as_stack: true`.
- The cross-repo contract is frozen during flow Phase 5; implementers never change it unilaterally.
- The slice ledger (`slices.json`), not the prose, is what `/orc:flow` Phase 5, `/orc:fan-out` and `orc-implementer` read.
- The P4 plan gate is the deliverable's approval; no autopilot level skips it standalone.

## Output

- `.orc/<branch>/files/plan.md` — the approved plan.
- `.orc/<branch>/files/checkpoint.md` — current phase and status.
- `slices.json`, installed via `orc-state slice init`.
- (with `--issues`) `.orc/<branch>/files/issues.md`.
- Updated `.orc/orc.json` registry entry.
- Interrupted: `/orc:resume` reads the checkpoint and jumps to the next pending phase.
