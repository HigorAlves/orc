---
description: Resume an interrupted multi-phase orc command from its last checkpoint. Reads .orc/orc.json for active sessions, picks one, jumps to the next pending phase. Workspace-aware.
argument-hint: "[<session-id-or-branch>] [--phase <n>] [--repo <name>]"
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
  - Bash(. */lib/workspace-detect.sh*)
---

# /orc:resume

Pick up where an earlier orc command left off. Required for any work that pauses overnight, gets interrupted by another priority, or crashes mid-pipeline.

## Arguments

- `<session-id-or-branch>` — optional. If provided, resume that session directly. Accepts either the `session_id` from `.orc/orc.json` or a branch name (sanitized or not).
- `--phase <n>` — optional. Skip to a specific phase rather than the next pending one. Use sparingly.
- `--repo <name>` — workspace mode only. Drill into a specific repo's slice of a workspace session (e.g. `--repo api` resumes only the api side of a cross-repo flow). Phase A scope: this command resumes one repo at a time; broadcast resume across all repos arrives in Phase C.

## Workflow

### Phase 1 — Detect context + locate the registry

Source the helper to determine where state lives:

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

Pick the registry to read from `$ORC_CONTEXT`:

- `repo` — the registry is `$ORC_STATE_DIR/orc.json` (`<repoRoot>/.orc/orc.json`). Standard single-repo behavior.
- `repo` **and** `<repoRoot>/.orc/<branch>/workspace-link.json` exists — this repo is a workspace member. Read `workspaceRoot` from the link file, resolve it against `$ORC_REPO_ROOT`, and use `<workspaceRoot>/.orc/orc.json` as the registry. Filter sessions to those with `repos` containing this repo's name.
- `workspace` — the registry is `$ORC_STATE_DIR/orc.json` (`<workspaceRoot>/.orc/orc.json`). Workspace sessions have `scope: "workspace"` and a `repos` array.
- `loose` — output `Cwd is neither a git repo nor a workspace parent — nothing to resume.` and stop.

If the chosen registry is missing or has no `in_progress` sessions, tell the user and stop.

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

Read the chosen session's artifacts. Paths depend on the session's `scope`:

- `scope: "repo"` (or no scope) — single-repo session. Artifacts at `<repoRoot>/.orc/<branch>/files/`.
- `scope: "workspace"` — workspace session. The shared plan/checkpoint/progress live at `<workspaceRoot>/.orc/<branch>/files/`. Per-repo artifacts (`progress.md`, `checkpoint.md` for the slice cursor) live at `<workspaceRoot>/<repo>/.orc/<branch>/files/` for each repo in `perRepoState`. When `--repo <name>` is set, restore only that repo's per-repo artifacts; otherwise default to "the cwd's repo" if cwd is inside one of the workspace's children, else `AskUserQuestion` for which repo to drill into.

Invoke `orc:executing-plans` for discipline around resumption (it has a "restore before you act" rule).

### Phase 4 — Validate

- Confirm the branch in `checkpoint.md` matches the current `git branch --show-current` (in workspace mode, run this `git` against the chosen `repoPath`). If not, ask whether to switch branches first.
- Confirm `.orc/<branch>/files/` is consistent (checkpoint phase ≤ artifacts present). For workspace sessions, also confirm the per-repo `workspace-link.json` back-pointer is intact and resolves to the workspace root we read from.
- If the session is `status: completed`, ask the user whether they want to re-open it (rare, but valid for "I want to revisit step 4").

### Phase 5 — Jump

Determine the next pending phase from the checkpoint. Re-invoke the corresponding command (`/orc:plan`, `/orc:debug`, `/orc:fan-out`, etc.) with a `--from-checkpoint` semantic. Pass the existing artifacts as context so it doesn't redo Phase 1's setup.

If `--phase <n>` was given, jump there directly.

### Phase 6 — Update the checkpoint

After the resumed work completes (or is paused again), update `checkpoint.md` and `.orc/orc.json` with the new state.

## Iron rule

`/orc:resume` is the **only** command allowed to read `.orc/orc.json` to make routing decisions. All other commands write to it; only `/orc:resume` and `/orc:status` route from it.

In workspace mode, this rule extends to both registries: the workspace `<workspaceRoot>/.orc/orc.json` *and* any per-repo `<repo>/.orc/orc.json`. `/orc:resume` and `/orc:status` are the only commands that walk `workspace-link.json` back-pointers to route between them.

## Output

- Echoes which session was resumed and from which phase.
- Hands off to the original command for the actual work.
