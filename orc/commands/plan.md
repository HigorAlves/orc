---
description: Plan a feature or refactor — produces a TDD-shaped plan, with optional design grilling, and decomposes into independently shippable issues. Writes to .orc/<branch>/files/. Phase 1 always asks to link a Jira ticket (skip-able); --jira <KEY> suppresses the prompt and links silently.
argument-hint: "[--grill] [--issues] [--jira <KEY>] <feature description>"
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
  - Bash(jq *)
---

# /orc:plan

Turn a feature or refactor request into a written, TDD-shaped implementation plan. Persist it to `.orc/<branch>/files/plan.md` so the work can pause and resume.

## Arguments

- `--grill` — after drafting the plan, invoke `orc:grill-me` to stress-test the design before committing.
- `--issues` — after the plan is approved, run `orc:to-issues` to break it into independently grabbable issues.
- `--jira <KEY>` — link a Jira ticket key (e.g. `PROJ-123`) to this session silently. Suppresses the Phase 1 link prompt. Validate against `^[A-Z][A-Z0-9_]*-\d+$`.
- The feature description is the rest of the argument string.

## Workflow

### Phase 0 — Detect PRD-shaped input (optional)

If the feature description is long-form, references a Jira ticket / linked doc, or reads more like a brief than a settled spec — dispatch the `orc-prd-analyzer` subagent via `Task` first. Pass it the input + the URL if there is one. The agent returns a structured analysis (extracted goals, ambiguities, P0/P1/P2 clarifying questions, recommendation).

`AskUserQuestion` after the analyzer returns:
- "Proceed to plan — questions are P1/P2 only"
- "Hold — answer P0 questions with PM first" (exit; don't waste planning effort)
- "Run `/orc:rfc` first — design space needs RFC treatment"

If the input is short and clear, skip Phase 0 and go straight to Phase 1.

### Phase 1 — Initialize workspace

1. Determine the current branch: `git branch --show-current`.
2. Sanitize: `feat/142-foo` → `feat-142-foo`.
3. Create `.orc/<sanitized-branch>/files/` if it doesn't exist.
4. **Resolve the Jira link.**
   - If `--jira <KEY>` was passed: validate against `^[A-Z][A-Z0-9_]*-\d+$`. Reject and stop on mismatch.
   - Otherwise: ask via `AskUserQuestion` — *"Link a Jira ticket to this session?"* with options:
     - `Paste a key` (then prompt for the key, validate the same way)
     - `Skip — I'll bind later via /orc:jira bind`
     - `No ticket — this work has no tracker entry`
   - When a key is resolved, set `JIRA_TICKET=<KEY>`. Otherwise leave `JIRA_TICKET=null`.
5. Append/update an entry in `.orc/orc.json` (central registry) with `command: "plan"`, `status: in_progress`, `current_phase: 1`, `total_phases: 4` (or 5 with `--issues`, 6 with `--grill --issues`), and `jiraTicket: <KEY>` (omit field if null).
6. Write `checkpoint.md` with frontmatter including `jiraTicket: <KEY>` if set.

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
