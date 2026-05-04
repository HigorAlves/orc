---
description: Resume an interrupted multi-phase orc command from its last checkpoint. Reads .orc/orc.json for active sessions, picks one, jumps to the next pending phase.
argument-hint: "[<session-id-or-branch>] [--phase <n>]"
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
  - Bash(date:*)
---

# /orc:resume

Pick up where an earlier orc command left off. Required for any work that pauses overnight, gets interrupted by another priority, or crashes mid-pipeline.

## Arguments

- `<session-id-or-branch>` — optional. If provided, resume that session directly. Accepts either the `session_id` from `.orc/orc.json` or a branch name (sanitized or not).
- `--phase <n>` — optional. Skip to a specific phase rather than the next pending one. Use sparingly.

## Workflow

### Phase 1 — Read the registry

Read `.orc/orc.json`. If it doesn't exist or has no `active` entries, tell the user and stop.

### Phase 2 — Choose a session (if not specified)

If a session ID/branch wasn't passed, render the active list via `AskUserQuestion`:

```
Active orc sessions:
1. plan       feat-142-notifs        phase 3/5  (started 2h ago)
2. debug      fix-cache-stale        phase 2/7  (started yesterday)
3. fan-out    refactor-billing       phase 4/6  (started 3 days ago)
```

If only one is active, skip the picker and use it.

### Phase 3 — Restore context

Read the chosen session's artifacts:
- `.orc/<branch>/files/checkpoint.md`
- `.orc/<branch>/files/orc.json`
- The current-phase artifact (`plan.md`, `diagnosis.md`, etc.)
- Any `progress.md`

Invoke `orc:executing-plans` for discipline around resumption (it has a "restore before you act" rule).

### Phase 4 — Validate

- Confirm the branch in `checkpoint.md` matches the current `git branch --show-current`. If not, ask whether to switch branches first.
- Confirm `.orc/<branch>/files/` is consistent (checkpoint phase ≤ artifacts present).
- If the session is `status: completed`, ask the user whether they want to re-open it (rare, but valid for "I want to revisit step 4").

### Phase 5 — Jump

Determine the next pending phase from the checkpoint. Re-invoke the corresponding command (`/orc:plan`, `/orc:debug`, `/orc:fan-out`, etc.) with a `--from-checkpoint` semantic. Pass the existing artifacts as context so it doesn't redo Phase 1's setup.

If `--phase <n>` was given, jump there directly.

### Phase 6 — Update the checkpoint

After the resumed work completes (or is paused again), update `checkpoint.md` and `.orc/orc.json` with the new state.

## Iron rule

`/orc:resume` is the **only** command allowed to read `.orc/orc.json` to make routing decisions. All other commands write to it; only `/orc:resume` and `/orc:status` route from it.

## Output

- Echoes which session was resumed and from which phase.
- Hands off to the original command for the actual work.
