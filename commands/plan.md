---
description: Plan a feature or refactor — produces a TDD-shaped plan, with optional design grilling, and decomposes into independently shippable issues. Writes to .orc/<branch>/files/.
argument-hint: "[--grill] [--issues] <feature description>"
allowed-tools:
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
---

# /orc:plan

Turn a feature or refactor request into a written, TDD-shaped implementation plan. Persist it to `.orc/<branch>/files/plan.md` so the work can pause and resume.

## Arguments

- `--grill` — after drafting the plan, invoke `orc:grill-me` to stress-test the design before committing.
- `--issues` — after the plan is approved, run `orc:to-issues` to break it into independently grabbable issues.
- The feature description is the rest of the argument string.

## Workflow

### Phase 1 — Initialize workspace

1. Determine the current branch: `git branch --show-current`.
2. Sanitize: `feat/142-foo` → `feat-142-foo`.
3. Create `.orc/<sanitized-branch>/files/` if it doesn't exist.
4. Append/update an entry in `.orc/orc.json` (central registry) with `command: "plan"`, `status: in_progress`, `current_phase: 1`, `total_phases: 4` (or 5 with `--issues`, 6 with `--grill --issues`).
5. Write `checkpoint.md` (phase=1, status=in_progress, started_at).

### Phase 2 — Draft the plan

Invoke `orc:writing-plans`. Follow that skill exactly. Write the output to `.orc/<branch>/files/plan.md`. Update `checkpoint.md` (phase=2, last_artifact=plan.md).

### Phase 3 (optional, with `--grill`) — Stress-test the design

Invoke `orc:grill-me`. The skill drives an interview that exposes hidden assumptions. Update `plan.md` with answers. Bump `checkpoint.md`.

### Phase 4 — Confirm with user

Use `AskUserQuestion` with two options: `Looks good — proceed` / `Iterate — revise plan`. If iterate, return to Phase 2.

### Phase 5 (optional, with `--issues`) — Decompose

Invoke `orc:to-issues` to break the approved plan into vertical-slice issues on the project tracker. Save the issue map to `.orc/<branch>/files/issues.md`. Bump `checkpoint.md` to phase=done.

## Output

- `.orc/<branch>/files/plan.md` — the approved plan
- `.orc/<branch>/files/checkpoint.md` — current phase + status
- (with `--issues`) `.orc/<branch>/files/issues.md`
- Updated `.orc/orc.json` registry entry

## Resume

If interrupted, `/orc:resume` reads the checkpoint and jumps to the next pending phase.
