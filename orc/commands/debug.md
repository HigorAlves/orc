---
description: Systematic root-cause investigation, then fix with TDD — never proposes a fix before finding the cause. Writes a diagnosis + regression test. --jira <KEY> links a ticket. Workspace-aware across sibling repos.
argument-hint: "[--jira <KEY>] [--repos a,b | --repo a | --all-repos | --this-repo] <bug description or failing test name>"
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
  - Bash(. */lib/workspace-detect.sh*)
---

# /orc:debug

Hard bugs and unexpected failures get the systematic-debugging discipline. NO FIXES WITHOUT A ROOT CAUSE.

## Arguments

- `--jira <KEY>` — link a Jira ticket key (e.g. `BUG-42`) to this session silently. Suppresses the Phase 1 link prompt.
- The bug description / failing test name is the rest of the argument string.

## Workflow

### Phase 0 — Detect context

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

In workspace mode, resolve `targetRepos` from flags or via `AskUserQuestion`. The default is the symptom-repo (the repo where the bug surfaces) plus any sibling repos the user suspects might be the actual cause — the investigator reads across all of them. Iron rule: no silent broadcast — confirm.

### Phase 1 — Initialize workspace + link

1. Determine the current branch: `git branch --show-current` (in workspace mode, prompt the user since cwd has no branch). Sanitize (`/` → `-`).
2. Create `${ORC_STATE_DIR}/<sanitized-branch>/files/` if it doesn't exist. In workspace mode, also create per-repo `<workspaceRoot>/<repo>/.orc/<sanitized-branch>/` with `workspace-link.json` back-pointers for each target repo (the diagnosis is workspace-level; remediation slices land per repo).
3. **Resolve the Jira link.**
   - If `--jira <KEY>` was passed: validate against `^[A-Z][A-Z0-9_]*-\d+$`. Reject and stop on mismatch.
   - Otherwise: ask via `AskUserQuestion` — *"Link a Jira ticket to this session?"* with options: `Paste a key` / `Skip — I'll bind later via /orc:jira bind` / `No ticket — this work has no tracker entry`.
4. Append/update an entry in `.orc/orc.json` with `command: "debug"`, `status: in_progress`, `current_phase: 1`, `total_phases: 7`, and `jiraTicket: <KEY>` (omit field if null). Write `checkpoint.md` with `jiraTicket` in the frontmatter when set.

### Phase 2 — Investigate (no fixes)

Dispatch the `orc-debug-investigator` subagent via `Task`. Pass it:
- The bug description / failing test name from arguments.
- The current branch + recent commits (`git log -10 --oneline`).
- Any relevant test output the user has already shared.
- **Workspace mode only**: `repo` (the symptom repo), `repoPath`, `siblingRepos` (the other target repos — the investigator may read across these to find the cause). Diagnosis is written to `${ORC_STATE_DIR}/<branch>/files/diagnosis.md` (workspace-level), and each remediation slice in the diagnosis carries a `repo:` annotation so the Phase 5 fixer can fan out per repo.

The agent returns a written diagnosis: root cause, evidence, recommended fix surface, recommended regression test. Save it to `${ORC_STATE_DIR}/<branch>/files/diagnosis.md`.

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

In workspace mode, group the diagnosis's remediation slices by their `repo:` tag and dispatch **one fixer per repo** (parallel, single response, multiple `Task` calls), each scoped to its own `repoPath`. Aggregate per-repo test reports into a single verdict before deciding green/red.

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
