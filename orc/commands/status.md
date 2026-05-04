---
description: Show all active and recently-completed orc workspaces from .orc/orc.json. Read-only — never modifies state.
argument-hint: "[--all] [--branch <name>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(date:*)
  - Bash(git branch --show-current:*)
---

# /orc:status

Quick view of orc's workspace state. Useful when you've juggled multiple features and want to know what you've left half-done.

## Arguments

- `--all` — include completed and abandoned sessions (default: in-progress only).
- `--branch <name>` — filter to a specific branch.

## Workflow

### Phase 1 — Read the registry

Read `.orc/orc.json`. If absent, output `No orc workspaces yet — nothing to resume.` and stop.

### Phase 2 — Render

Render a markdown table. If a session has `jiraTicket` set, append a `Jira` column showing `[<KEY>]`; if no session in the table has one, omit the column entirely (don't show empty cells everywhere just because one session is unlinked):

```
| # | Command   | Branch                       | Phase | Status        | Updated     | Jira       |
|---|-----------|------------------------------|-------|---------------|-------------|------------|
| 1 | plan      | feat-142-notifs              | 3/5   | in_progress   | 2h ago      | [JRA-123]  |
| 2 | debug     | fix-cache-stale              | 2/7   | in_progress   | yesterday   | —          |
| 3 | fan-out   | refactor-billing             | 4/6   | in_progress   | 3 days ago  | [PLAT-99]  |
```

Apply filters (`--all`, `--branch`) before rendering. Sort by `updated_at` descending.

### Phase 3 — Per-session detail

After the table, for each in-progress session, render a 2-line summary. Append `· [<KEY>]` to the title line when `jiraTicket` is set:

```
1. plan / feat-142-notifs · [JRA-123]
   Last artifact: .orc/feat-142-notifs/files/plan.md (last updated 2h ago)
   Next: phase 4 — confirm with user, then optionally `/orc:plan --issues`
```

### Phase 4 — Resume hint

End with: `Run /orc:resume to continue any session.`

## Iron rule

This command is read-only. It does NOT modify `.orc/orc.json` or any workspace artifact. If anything looks stale (e.g. a session marked in_progress but the branch is long-deleted), surface it as a warning — but don't auto-clean.

## Output

- A markdown table + per-session summaries
- A resume hint
