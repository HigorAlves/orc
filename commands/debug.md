---
description: Systematic root-cause investigation, then fix with TDD. Writes a diagnosis + regression test to .orc/<branch>/files/. Never proposes a fix without finding the cause first.
argument-hint: "<bug description or failing test name>"
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
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(go *:*)
  - Bash(cargo *:*)
  - Bash(pytest *:*)
---

# /orc:debug

Hard bugs and unexpected failures get the systematic-debugging discipline. NO FIXES WITHOUT A ROOT CAUSE.

## Workflow

### Phase 1 — Investigate (no fixes)

Dispatch the `orc-debug-investigator` subagent via `Task`. Pass it:
- The bug description / failing test name from arguments.
- The current branch + recent commits (`git log -10 --oneline`).
- Any relevant test output the user has already shared.

The agent returns a written diagnosis: root cause, evidence, recommended fix surface, recommended regression test. Save it to `.orc/<branch>/files/diagnosis.md`.

### Phase 2 — Confirm with user

Use `AskUserQuestion`:
- "Diagnosis looks right — proceed with fix"
- "Need more investigation — re-dispatch investigator with this hint: …"
- "Diagnosis is wrong — abort"

### Phase 3 — Write the regression test (TDD red)

Invoke `orc:tdd`. Write the test described in the diagnosis. Run the suite — it MUST fail with the expected message (proving it captures the bug). Commit the failing test on a fix branch.

### Phase 4 — Fix and verify

Hand the diagnosis + regression test to `orc-code-fixer` via `Task`. The agent applies the fix, re-runs tests. Read the report. If green, proceed. If red, return to Phase 1 with the new evidence.

### Phase 5 — Verify thoroughly

Invoke `orc:verification-before-completion`. Confirm:
- The new regression test passes.
- The full suite passes (no other tests broke).
- Any related code paths still behave correctly (`orc:error-handling-patterns` if error handling was touched).

### Phase 6 — Checkpoint

Update `.orc/<branch>/files/checkpoint.md` to phase=done, with paths to `diagnosis.md`, the test file, and the fix file.

## Output

- `.orc/<branch>/files/diagnosis.md`
- One regression test (committed)
- The fix (committed in a separate commit per `orc:git-commit`)
- Checkpoint set to done

## Resume

If interrupted between phases, `/orc:resume` reads checkpoint and continues from the next pending phase.
