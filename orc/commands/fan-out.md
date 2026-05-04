---
description: Parallel-dispatch N independent tasks that don't share state — paralleled investigations, multi-PR review, multi-repo work, doc bulk updates. For parallel-safe slices within a single feature plan, prefer /orc:flow (which dispatches parallel batches inside Phase 5 with the full lifecycle around them). /orc:fan-out is the standalone parallelism primitive, no surrounding lifecycle. Writes per-task results to .orc/<branch>/files/fan-out/.
argument-hint: "[--from-plan] [--max <n>] [--agent <name>] <task list or 'use plan.md'>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(git *)
---

# /orc:fan-out

When you have N independent tasks that can run without sharing state, fan them out instead of doing them sequentially.

## When to reach for `/orc:fan-out` vs `/orc:flow`

- **`/orc:flow`** — when you're driving ONE feature/bug/refactor end-to-end and the plan has parallel-safe slices in Phase 5. The umbrella handles the parallel dispatch inside the lifecycle (plan → start → parallel implementation → QA → ship).
- **`/orc:fan-out`** — when you have N independent things that aren't a single feature pipeline. Multi-PR review, paralleled investigations, multi-repo work, doc bulk updates, partial-plan execution without the full lifecycle. No phases, no QA, no ship — just dispatch and collect.

The two are different abstraction levels: `/orc:flow` is a lifecycle, `/orc:fan-out` is a parallelism primitive.

## Arguments

- `--from-plan` — read tasks from the current `.orc/<branch>/files/plan.md` (or named plan). De-emphasized path: for plans inside an active feature flow, prefer `/orc:flow` which handles parallel batches in-context with QA + ship after.
- `--max <n>` — cap concurrent agents (default 5; 8 for Sonnet-only sets).
- `--agent <name>` — explicit agent type for all tasks (e.g. `--agent orc-pr-reviewer` for multi-PR review, `--agent orc-debug-investigator` for paralleled investigations). Default: auto-pick per task shape (slice → orc-implementer; otherwise general-purpose).
- The remaining argument is either a freeform task list or `use plan.md`.

## Workflow

### Phase 1 — Load tasks

If `--from-plan`: read the plan file, extract tasks marked as parallel-safe (the `orc:writing-plans` skill marks these explicitly).
Otherwise: parse the user's argument list.

### Phase 2 — Verify independence

Invoke `orc:dispatching-parallel-agents`. The skill enforces that no two tasks share state, file ownership, or sequential dependencies. If it flags a violation, surface it via `AskUserQuestion` and ask the user to either (a) merge dependent tasks into one, (b) sequence them, or (c) confirm override.

### Phase 3 — Init workspace

Create `.orc/<branch>/files/fan-out/` with one subdir per task: `task-01-<slug>/`, `task-02-<slug>/`, etc. Write `.orc/<branch>/files/checkpoint.md` (phase=3, status=in_progress, total_phases=6, command=fan-out, started_at=now). Append entry to `.orc/orc.json` central registry with the task count and per-task status.

### Phase 4 — Dispatch (parallel)

For each task, pick the right agent:

- **Plan-slice-shaped tasks** (the task is a vertical slice from a plan, with file ownership and a failing test) — dispatch `orc-implementer` with a 1-slice list and `mode: parallel`. The implementer returns a diff + test report rather than committing directly; phase 5 below merges and commits them in plan order. This is the right choice when fan-out tasks were derived from an `/orc:plan --issues` decomposition.
- **Other tasks** (research, doc updates, exploratory investigation, anything not a plan slice) — dispatch `general-purpose` (or a more specific orc agent if one fits, e.g. `orc-debug-investigator` for a paralleled bug-investigation, `orc-pr-reviewer` for paralleled review of multiple PRs).

Each `Task` dispatch gets:
- The task description (or slice ID for implementer)
- The task's working directory (worktree if available, else current)
- The output path: `.orc/<branch>/files/fan-out/task-NN-<slug>/result.md`

All `Task` calls are issued in a single response (parallel execution). Cap by `--max`.

Bump `checkpoint.md` to phase=4 immediately after dispatch (so a crashed orchestrator session can be resumed by `/orc:resume` and read the per-task result files when agents complete).

### Phase 5 — Collect

After agents return, read each `result.md`. Update `.orc/<branch>/files/fan-out/summary.md` with one row per task: status, key artifact path, time elapsed. Bump `checkpoint.md` to phase=5 with `last_artifact: fan-out/summary.md`.

### Phase 6 — Decide next

Use `AskUserQuestion`:
- "All done — proceed"
- "Re-run failed tasks: <list>"
- "Continue with /orc:ship now"

Whichever is chosen, mark `checkpoint.md` phase=done (or phase=5 if user re-runs) and update the central registry's status field accordingly.

## Iron rule

Independence is non-negotiable. If two tasks could fight over the same file or symbol, they don't fan out — they sequence. Burning time on rework after an unsafe parallel dispatch is more expensive than just sequencing them in the first place.

## Output

- `.orc/<branch>/files/fan-out/` with per-task subdirectories
- `summary.md` aggregating all results
- Updated `.orc/orc.json`
