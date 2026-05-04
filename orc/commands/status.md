---
description: Show all active and recently-completed orc workspaces from .orc/orc.json. Read-only — never modifies state. Workspace-aware.
argument-hint: "[--all] [--branch <name>] [--repo <name>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(date:*)
  - Bash(git branch --show-current:*)
  - Bash(. */lib/workspace-detect.sh*)
---

# /orc:status

Quick view of orc's workspace state. Useful when you've juggled multiple features and want to know what you've left half-done.

## Arguments

- `--all` — include completed and abandoned sessions (default: in-progress only).
- `--branch <name>` — filter to a specific branch.
- `--repo <name>` — workspace mode only: filter to one member repo (e.g. `--repo api`).

## Workflow

### Phase 1 — Detect context

Source the workspace-detect helper and capture the active context:

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

Branch on `$ORC_CONTEXT`:

- `repo` — single-repo mode. Read `$ORC_STATE_DIR/orc.json` as the only registry.
- `workspace` — workspace mode. Read the workspace registry **plus** the per-repo registries (see Phase 2).
- `loose` — output `Cwd is neither a git repo nor a workspace parent — orc has no state to read here.` and stop.

If the chosen registry is absent, output `No orc workspaces yet — nothing to resume.` and stop.

### Phase 2 — Load registries

**Single-repo mode:** load `$ORC_STATE_DIR/orc.json` and proceed to Phase 3 with its `sessions` array.

**Workspace mode:**

1. Load `$ORC_STATE_DIR/orc.json` (the workspace registry, `<workspaceRoot>/.orc/orc.json`). Sessions here have `scope: "workspace"`, `repos`, `perRepoState`, `linkedPRs`.
2. For each child repo in `$ORC_WORKSPACE_REPOS` (comma-separated), read `<workspaceRoot>/<repo>/.orc/orc.json` if present:
   - Sessions with `scope: "repo"` (or no `scope`, treated as legacy) — standalone single-repo sessions inside a workspace child. Show in their own group.
   - Sessions with `scope: "workspace-member"` — back-pointers to a workspace session already loaded above. Skip; do NOT double-render.
3. `--repo <name>` filters workspace sessions' `perRepoState` rows to that repo and filters the standalone-session group to that repo. `--branch` / `--all` filters apply normally.

### Phase 3 — Render

Render a markdown table. If a session has `jiraTicket` set, append a `Jira` column showing `[<KEY>]`; if no session in the table has one, omit the column entirely:

```
| # | Command   | Branch                       | Phase | Status        | Updated     | Jira       |
|---|-----------|------------------------------|-------|---------------|-------------|------------|
| 1 | plan      | feat-142-notifs              | 3/5   | in_progress   | 2h ago      | [JRA-123]  |
| 2 | debug     | fix-cache-stale              | 2/7   | in_progress   | yesterday   | —          |
| 3 | fan-out   | refactor-billing             | 4/6   | in_progress   | 3 days ago  | [PLAT-99]  |
```

In workspace mode, render in two groups:

1. **Workspace sessions** — header `## Workspace: <name> — <N> repos: <list>`. Each row's `Branch` cell shows `<branch> (<R>/N repos)` where R is the count of repos still in flight. After the table, expand each session into a per-repo sub-table:
   ```
   1. flow / feat-sso-login · spans api, ui
      | repo | branch          | slice | PR              | status        |
      |------|-----------------|-------|-----------------|---------------|
      | api  | feat/sso-login  | 2/4   | org/api#311     | in_progress   |
      | ui   | feat/sso-login  | 1/3   | —               | in_progress   |
   ```
2. **Standalone sessions in workspace children** (only if non-empty) — header `## Standalone repo sessions`. Same shape as single-repo mode, with a `Repo` column added.

Apply filters before rendering. Sort each group by `updated_at` descending.

### Phase 4 — Per-session detail

After the table(s), for each in-progress session render a 2-line summary. Append `· [<KEY>]` to the title line when `jiraTicket` is set:

```
1. plan / feat-142-notifs · [JRA-123]
   Last artifact: .orc/feat-142-notifs/files/plan.md (last updated 2h ago)
   Next: phase 4 — confirm with user, then optionally `/orc:plan --issues`
```

For workspace sessions, the "Last artifact" line points at the workspace plan path (`<workspaceRoot>/.orc/<branch>/files/plan.md`) and the "Next" line names the phase + which repos still need to advance.

### Phase 5 — Resume hint

End with: `Run /orc:resume to continue any session.` In workspace mode add: `Pass --repo <name> to /orc:resume to drill into one repo.`

## Iron rule

This command is read-only. It does NOT modify `.orc/orc.json` or any workspace artifact. If anything looks stale (e.g. a session marked in_progress but the branch is long-deleted), surface it as a warning — but don't auto-clean.

## Output

- A markdown table + per-session summaries
- A resume hint
