---
description: Resume an interrupted multi-phase orc command from its last checkpoint. Reads .orc/orc.json for active sessions, picks one, jumps to the next pending phase. Workspace-aware.
argument-hint: "[<session-id-or-branch>] [--phase <n>] [--repo <name>]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(git:*)
  - Bash(date:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:resume

Pick up where an earlier orc command left off. Required for any work that pauses overnight, gets interrupted by another priority, or crashes mid-pipeline.

## Arguments

- `<session-id-or-branch>` — optional. If provided, resume that session directly. Accepts either the `sessionId` from `.orc/orc.json` (list via `orc-state sessions`) or a branch name (sanitized or not); schema per `orc:state-protocol`.
- `--phase <n>` — optional. Skip to a specific phase rather than the next pending one. Use sparingly.
- `--repo <name>` — workspace mode only. Drill into a specific repo's slice of a workspace session (e.g. `--repo api` resumes only the api side of a cross-repo flow). Phase A scope: this command resumes one repo at a time; broadcast resume across all repos arrives in Phase C.

## Workflow

### Phase 1 — Detect context + locate the registry

The context banner is injected below (`ORC_*` vars are exported for any Bash you run — do not re-run detection):

!`orc-workspace-detect --banner`

Pick the registry to read from the banner's context:

- `repo` — the registry is `$ORC_STATE_DIR/orc.json` (`<repoRoot>/.orc/orc.json`). Standard single-repo behavior.
- `repo` **and** `<repoRoot>/.orc/<branch>/workspace-link.json` exists — this repo is a workspace member. Read `workspaceRoot` from the link file, resolve it against `$ORC_REPO_ROOT`, and use `<workspaceRoot>/.orc/orc.json` as the registry. Filter sessions to those with `repos` containing this repo's name.
- `workspace` — the registry is `$ORC_STATE_DIR/orc.json` (`<workspaceRoot>/.orc/orc.json`). Workspace sessions have `scope: "workspace"` and a `repos` array.
- `loose` — surface a `[!WARNING]` **⚠️ Caution** callout (`Cwd is neither a git repo nor a workspace parent — nothing to resume.`) and stop.

If the chosen registry is missing or has no `in_progress` sessions, tell the user and stop.

### Phase 2 — Choose a session (if not specified)

If a session ID/branch wasn't passed: `orc-state sessions --status in_progress` renders one line per session — show the list via `AskUserQuestion`. If only one is active, skip the picker and use it.

### Phase 3 — Restore context (the startup sequence — never a wholesale replay)

Run the **session-startup sequence** from `orc:state-protocol`, in order:

1. The context banner is already injected above.
2. The chosen session's entry (`orc-state get <sessionId>`).
3. Read `checkpoint.md` — bounded by construction (frontmatter + digest, ≤4 KB).
4. `git log --oneline -10` + `git status --porcelain` in the session's worktree — cross-check the digest's `Suite:`/commit claims against reality; a dirty tree or sha mismatch is surfaced before acting.
5. If `slices.json` exists: `orc-state slice list` → the exact re-entry slice.
6. Read **only** the artifact the digest's `Next:` names (`plan.md` for implement, `diagnosis.md` for a fix, `ci-diagnosis.md` for a CI route). Never enumerate `files/`; `progress.md` is history and stays unread unless the user asks.
7. `orc-state verify <sessionId>` — a registry/checkpoint mismatch is surfaced, not silently repaired.

Workspace sessions (`scope: "workspace"`): the shared checkpoint lives at `<workspaceRoot>/.orc/<branch>/files/`; per-repo slice cursors at `<workspaceRoot>/<repo>/.orc/<branch>/files/`. With `--repo <name>`, run steps 3–7 against that repo's slice only; otherwise default to cwd's repo when inside a workspace child, else `AskUserQuestion` which repo to drill into. Confirm the per-repo `workspace-link.json` back-pointer resolves to the workspace root the registry came from.

If the branch doesn't match `git branch --show-current` (workspace mode: against the chosen `repoPath`), ask whether to switch first. If the session is `status: completed`, ask whether to re-open it.

### Phase 4 — Jump

Determine the next pending phase from the checkpoint frontmatter. Re-invoke the corresponding command (`/orc:plan`, `/orc:debug`, `/orc:fan-out`, etc.) with a `--from-checkpoint` semantic — pass **the digest and the one `Next:` artifact**, nothing more; the command must not redo its Phase 1 setup or re-read the artifact tree.

If `--phase <n>` was given, jump there directly.

### Phase 5 — Update the checkpoint

After the resumed work completes (or pauses again): `orc-state phase set <n>` + `orc-state digest write -` (per `orc:state-protocol`).

## Iron rule

**Route-from-state** (enumerating sessions to decide what to run — `orc-state sessions`) belongs only to `/orc:resume`, `/orc:status`, `/orc:cleanup`, and `/orc:flow`'s self-resume scoped to its own session. Any command may **read-for-data** (`orc-state get [--field]` on its already-known session). Definitions: `orc:state-protocol`.

In workspace mode, this rule extends to both registries: the workspace `<workspaceRoot>/.orc/orc.json` *and* any per-repo `<repo>/.orc/orc.json`. `/orc:resume` and `/orc:status` are the only commands that walk `workspace-link.json` back-pointers to route between them.

## Output

- Echoes which session was resumed and from which phase.
- Hands off to the original command for the actual work.
