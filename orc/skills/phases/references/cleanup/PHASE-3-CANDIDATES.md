<!-- orc:cleanup/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Build the candidate list

1. If the argument names a session, use that one candidate.
2. If `--all-completed`, take every session with `status` in `{completed, abandoned}`.
3. Otherwise, render every session (format below) and ask via `AskUserQuestion`.
4. Keep only the sessions the user picks.
5. Exclude `in_progress` sessions unless the user explicitly opts to abandon one.
6. For each `in_progress` session the user abandons, ask a separate confirmation.

```
1. plan       feat-142-notifs        completed   2 days ago
2. debug      fix-cache-stale        completed   yesterday
3. fan-out    refactor-billing       in_progress 1 hour ago
```
