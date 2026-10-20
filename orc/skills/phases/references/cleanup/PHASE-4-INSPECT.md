<!-- orc:cleanup/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Inspect each candidate

1. For each candidate, run the inspection commands below.
2. If `<state-dir>/<branch>/files/docker-env-state.json` exists, read it.
3. Run `orc-docker-env teardown-preview <state-file>` for the Docker preview lines.
4. Run the orphan sweep once per cleanup (command below).
5. Build the per-session summary (template below).
6. If any `linkedPRs[]` entry has a `stackId`, group by `stackId` (jq below).
7. Fetch each stack member's merge state via `gh pr view`.
8. Derive each member's deletion gate from the stack rules below.
9. Keep any member whose parent PR is open; note "waiting on parent #N" for P5.

Inspection:

```bash
# Worktree path (if any)
git worktree list --porcelain | awk '/^worktree /{wt=$2} /^branch /{print wt, $2}'
# Branch merged into main?
git branch --merged main | grep -E "^[* ] $branch_name$"
# Worktree has uncommitted changes?
( cd "$worktree_path" 2>/dev/null && git status --porcelain | wc -l )
# Branch has unpushed commits?
git log "origin/$branch_name..$branch_name" --oneline 2>/dev/null | wc -l
```

Orphan sweep: `orc-docker-env orphans <known-projects...>`, where the known projects come from every candidate's state file.

Per-session summary:

```
Session: <session-id>
Branch: <branch>
Workspace: .orc/<sanitized-branch>/  (size: <N> files)
Worktree:  <path or "none">           (dirty: <yes|no>)
Docker env: <project or "none">       (live: <yes|no>, volumes: <list>)
Branch merged into main? <yes|no>
Unpushed commits? <count>
```

Stack grouping:

```bash
# Per stack: ordered list of {position, url, branch, state}
jq -r --arg sid "$SESSION_ID" '
  .sessions[] | select(.sessionId == $sid) | .linkedPRs
  | map(select(.stackId != null))
  | group_by(.stackId)
  | map({
      stackId: .[0].stackId,
      members: sort_by(.stackPosition)
    })
' "$ORC_STATE_DIR/orc.json"

# For each member, fetch merge state via gh pr view (state).
```

Stack rules:

- Position 1 (root): deletable when its own PR is `MERGED`.
- Position N > 1: deletable when its own PR and the position N-1 PR are both `MERGED`.
- Delete parents first within each stack; a member whose parent is open stays, even when the member itself merged.

NOTE: the child branch's history rests on the parent branch. Deleting the parent's local branch before the parent merges orphans the child. Deleting the child first while the parent is unmerged is fine.
