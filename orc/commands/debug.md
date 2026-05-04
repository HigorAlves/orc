---
description: Systematic root-cause investigation, then fix with TDD. Writes a diagnosis + regression test to .orc/<branch>/files/. Never proposes a fix without finding the cause first. Phase 1 always asks to link a Jira ticket (skip-able); --jira <KEY> suppresses the prompt and links silently.
argument-hint: "[--jira <KEY>] <bug description or failing test name>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(git log:*)
  - Bash(git blame:*)
  - Bash(git diff:*)
  - Bash(git branch --show-current:*)
  - Bash(jq *)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(go *:*)
  - Bash(cargo *:*)
  - Bash(pytest *:*)
---

# /orc:debug

Hard bugs and unexpected failures get the systematic-debugging discipline. NO FIXES WITHOUT A ROOT CAUSE.

## Arguments

- `--jira <KEY>` — link a Jira ticket key (e.g. `BUG-42`) to this session silently. Suppresses the Phase 1 link prompt.
- The bug description / failing test name is the rest of the argument string.

## Workflow

### Phase 1 — Initialize workspace + link

1. Determine the current branch: `git branch --show-current`. Sanitize (`/` → `-`).
2. Create `.orc/<sanitized-branch>/files/` if it doesn't exist.
3. **Resolve the Jira link.**
   - If `--jira <KEY>` was passed: validate against `^[A-Z][A-Z0-9_]*-\d+$`. Reject and stop on mismatch.
   - Otherwise: ask via `AskUserQuestion` — *"Link a Jira ticket to this session?"* with options: `Paste a key` / `Skip — I'll bind later via /orc:jira bind` / `No ticket — this work has no tracker entry`.
4. Append/update an entry in `.orc/orc.json` with `command: "debug"`, `status: in_progress`, `current_phase: 1`, `total_phases: 7`, and `jiraTicket: <KEY>` (omit field if null). Write `checkpoint.md` with `jiraTicket` in the frontmatter when set.

### Phase 2 — Investigate (no fixes)

Dispatch the `orc-debug-investigator` subagent via `Task`. Pass it:
- The bug description / failing test name from arguments.
- The current branch + recent commits (`git log -10 --oneline`).
- Any relevant test output the user has already shared.

The agent returns a written diagnosis: root cause, evidence, recommended fix surface, recommended regression test. Save it to `.orc/<branch>/files/diagnosis.md`.

### Phase 3 — Confirm with user

Use `AskUserQuestion`:
- "Diagnosis looks right — proceed with fix"
- "Need more investigation — re-dispatch investigator with this hint: …"
- "Diagnosis is wrong — abort"

### Phase 4 — Write the regression test (TDD red)

Invoke `orc:tdd`. Write the test described in the diagnosis. Run the suite — it MUST fail with the expected message (proving it captures the bug). Commit the failing test on a fix branch.

For **complex regression tests** (multi-branch state machines, async coordination, integration boundaries) — dispatch the `orc-test-author` subagent via `Task` instead of writing inline. Pass it the diagnosis's "recommended regression test" section + the affected file. The agent returns a comprehensive test (happy path + boundary + error paths) using the project's existing test idioms, runs the suite, reports.

`AskUserQuestion`:
- "Write inline (orc:tdd)" — for simple single-assertion regressions
- "Dispatch orc-test-author" — for complex test scenarios
- "Auto-pick — orc decides based on diagnosis depth"

### Phase 5 — Fix and verify

Hand the diagnosis + regression test to `orc-code-fixer` via `Task`. The agent applies the fix, re-runs tests. Read the report. If green, proceed. If red, return to Phase 2 (Investigate) with the new evidence.

### Phase 6 — Verify thoroughly

Invoke `orc:verification-before-completion`. Confirm:
- The new regression test passes.
- The full suite passes (no other tests broke).
- Any related code paths still behave correctly (`orc:error-handling-patterns` if error handling was touched).

### Phase 7 — Checkpoint

Update `.orc/<branch>/files/checkpoint.md` to phase=done, with paths to `diagnosis.md`, the test file, and the fix file.

## Output

- `.orc/<branch>/files/diagnosis.md`
- One regression test (committed)
- The fix (committed in a separate commit per `orc:git-commit`)
- Checkpoint set to done

## Resume

If interrupted between phases, `/orc:resume` reads checkpoint and continues from the next pending phase.
