---
description: Start a feature — set up an isolated worktree, draft the plan, and write the first failing test before any production code is touched.
argument-hint: "[--worktree <path>] <feature description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git *)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(go *:*)
  - Bash(cargo *:*)
  - Bash(pytest *:*)
---

# /orc:start

Kick off a new feature with isolation, a written plan, and the first failing test — all before production code is touched. The TDD red light is the entry gate.

## Arguments

- `--worktree <path>` — optional explicit worktree directory. If omitted, the worktree skill picks one safely.

## Workflow

### Phase 1 — Worktree

Invoke `orc:using-git-worktrees`. Create an isolated worktree off the current default branch (typically `main`). Switch the session to that worktree. The PreToolUse hook will refuse subsequent commits to `main`/`master`/`develop`, so you must be on a feature branch from this point.

### Phase 2 — Plan

Invoke `/orc:plan` (skip `--issues`, skip `--grill` unless user opts in). The plan is written to `.orc/<branch>/files/plan.md`.

### Phase 3 — First failing test

Invoke `orc:tdd`. Per its red-green-refactor doctrine:
1. Pick the first vertical slice from the plan.
2. Write the test that demonstrates the desired behavior.
3. Run the test suite — it MUST fail with the expected message (not "test not found", not a setup error).
4. If the failure isn't the right one, fix the test until it is.
5. Stop. Do NOT implement yet. The whole point is that the next session knows exactly where to start.

### Phase 4 — Checkpoint

Update `.orc/<branch>/files/checkpoint.md` (phase=ready-for-implementation, last_artifact=test-file:line). Update `.orc/orc.json`.

## Output

- New worktree at `<chosen-path>` on a feature branch
- `.orc/<branch>/files/plan.md`
- One failing test in the codebase, committed (per `orc:git-commit`)
- Checkpoint set to `ready-for-implementation`

## Resume

`/orc:resume` will pick up at the implementation phase — that's where `/orc:start` deliberately stops.
