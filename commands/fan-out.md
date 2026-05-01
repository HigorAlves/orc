---
description: Dispatch independent tasks to parallel sub-sessions. Reads a task list (from a plan or supplied directly), runs them concurrently, recombines results. Writes to .orc/<branch>/files/.
argument-hint: "[--from-plan] [--max <n>] <task list or 'use plan.md'>"
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

When you have 2+ independent tasks that can run without sharing state, fan them out instead of doing them sequentially.

## Arguments

- `--from-plan` — read tasks from the current `.orc/<branch>/files/plan.md` (or named plan).
- `--max <n>` — cap concurrent agents (default 5; 8 for Sonnet-only sets).
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

For each task, dispatch a `Task` (subagent_type=general-purpose unless a more specific orc agent fits) with:
- The task description
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
