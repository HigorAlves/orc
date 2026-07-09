---
description: Clean up after completed or abandoned orc sessions — removes workspace state, registry entry, git worktree, and optionally the merged branch. Destructive; always previews and asks first. Workspace-aware.
argument-hint: "[--dry-run] [--all-completed] [--per-repo] [<session-id-or-branch>]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git worktree:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(gh pr view:*)
  - Bash(rm -rf .orc:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:cleanup

Close the loop on finished orc work — remove the workspace state, the worktree, and (if safe) the local feature branch.

## Arguments

- `<session-id-or-branch>` — optional. Clean up exactly one session. Accepts the `session_id` from `.orc/orc.json` or a (sanitized or raw) branch name.
- `--all-completed` — clean up every session whose `status` in `.orc/orc.json` is `completed` or `abandoned`. Respects all the safety checks below per session.
- `--dry-run` — print what *would* happen but make no changes. Recommended for the first run.
- `--per-repo` — workspace mode: clean each linked repo independently as its PR merges, instead of waiting for all to merge. Use only when you intend to abandon some repos (rare).

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection).

In workspace mode, the registry to read in Phase 2 is `${ORC_STATE_DIR}/orc.json` (workspace-level). Workspace sessions have `scope: "workspace"` and a `repos` array. For each candidate workspace session, fetch PR merge status for every URL in `linkedPRs`:

```bash
for url in $(jq -r '.sessions[] | select(.session_id == "'$ID'") | .linkedPRs[].url' "$ORC_STATE_DIR/orc.json"); do
  gh pr view "$url" --json state -q .state
done
```

If **any** linked PR is not `MERGED`, **default behavior is to refuse** with a summary of which PRs are still open. The user must either: (a) wait, (b) pass `--per-repo` to clean only the merged ones, or (c) explicitly mark the session `abandoned` first to bypass the merge check.

### Phase 1 — Refuse to run from inside a soon-to-be-deleted worktree

```bash
current_path=$(pwd)
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
```

If a session about to be cleaned up matches the current worktree path or current branch, abort with a clear message: "You're inside the worktree this command would remove. `cd` to the main repo first."

### Phase 2 — Read the registry

Read `.orc/orc.json`. If absent or empty, surface and stop. If a specific session was requested but not found, surface and stop (don't silently no-op).

### Phase 3 — Build the candidate list

If `<session-id-or-branch>` was given: 1 candidate. If `--all-completed`: every session with `status` in `{completed, abandoned}`. Otherwise: render all sessions and prompt via `AskUserQuestion`:

```
1. plan       feat-142-notifs        completed   2 days ago
2. debug      fix-cache-stale        completed   yesterday
3. fan-out    refactor-billing       in_progress 1 hour ago
```

Filter to candidates the user picks. **Default-exclude `in_progress` sessions** unless the user explicitly opts to abandon one — surface a separate confirmation for each.

### Phase 4 — Inspect each candidate

For each candidate session, gather:

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

Build a per-session summary:

```
Session: <session-id>
Branch: <branch>
Workspace: .orc/<sanitized-branch>/  (size: <N> files)
Worktree:  <path or "none">           (dirty: <yes|no>)
Branch merged into main? <yes|no>
Unpushed commits? <count>
```

**Stack-aware enrichment.** If `linkedPRs[]` contains any entry with `stackId != null`, group by `stackId` and fetch each PR's merge state:

```bash
# Per stack: ordered list of {position, url, branch, state}
jq -r --arg sid "$SESSION_ID" '
  .sessions[] | select(.session_id == $sid) | .linkedPRs
  | map(select(.stackId != null))
  | group_by(.stackId)
  | map({
      stackId: .[0].stackId,
      members: sort_by(.stackPosition)
    })
' "$ORC_STATE_DIR/orc.json"

# For each member, fetch merge state via gh pr view (state).
```

For each stack member, derive a per-branch deletion gate:

- **Position 1 (root)**: deletable iff its own PR is `MERGED` (same as the existing rule).
- **Position N > 1**: deletable iff its own PR is `MERGED` **AND** the position N-1 PR is also `MERGED`. The child branch's history rests on the parent branch; deleting the parent's local branch before the parent merges leaves the child orphaned. Deleting the child first when the parent is unmerged is fine — but deleting the parent first is not.

Practically: enforce **bottom-up branch deletion** within each stack. Any stack member whose parent is still open is **kept** with a "waiting on parent #N" note in the preview, even if the child itself merged.

### Phase 5 — Render the cleanup plan + confirm

Open with the danger callout, then list exactly what will be done in a fence (the ✓/⚠/⊘ plan lines stay in the fence — alignment matters):

```markdown
> [!CAUTION]
> **🛑 Destructive preview**
>
> The plan below removes workspace state, worktrees, and branches. Skipped items (⚠/⊘) stay untouched.
```

```
Will clean up:

[feat-142-notifs]
  ✓ rm -rf .orc/feat-142-notifs/
  ✓ remove from .orc/orc.json
  ✓ git worktree remove ../wt-feat-142-notifs   (clean)
  ✓ git branch -d feat-142-notifs                (merged into main)

[fix-cache-stale]
  ✓ rm -rf .orc/fix-cache-stale/
  ✓ remove from .orc/orc.json
  ⚠ worktree at ../wt-fix-cache-stale has 3 uncommitted files — SKIP worktree removal
  ⚠ branch fix-cache-stale not merged into main — SKIP branch deletion
```

**Stack-aware preview block** (rendered when a session has stack members):

```
[feat-export]   stack <stackId> (3 PRs, bottom-up)
  ✓ 01 api#311  MERGED  → branch feat/export/01-... deletable
  ✓ 02 api#312  MERGED  → branch feat/export/02-... deletable (parent merged)
  ⊘ 03 ui#447   OPEN    → keep until merge
     · child branches stay (waiting for #447)
```

When a child shows as `MERGED` but its parent is still `OPEN` (rare, usually the result of a fold or out-of-order merge):

```
  ⚠ 03 ui#447   MERGED  → branch DEFERRED — parent #312 still OPEN
     · pass --per-repo to delete the child branch out of order
```

Show the full plan via `AskUserQuestion`:
- "Proceed — apply the plan as shown"
- "Edit plan — pick individual items to skip"
- "Cancel"

If `--dry-run`: print the plan and exit; never apply.

### Phase 6 — Apply (with safety gates)

For each session:

1. **Workspace state** — `rm -rf .orc/<sanitized-branch>/`. Update `.orc/orc.json` to remove the entry (use Read + Write to preserve the JSON).
2. **Worktree** — `git worktree remove <path>` ONLY if clean. If dirty, skip and surface a `**⚠️ Skipped — dirty worktree**` `[!WARNING]` callout. Never use `--force` automatically; require an explicit `--force-dirty` flag in a future iteration if needed.
3. **Branch** — `git branch -d <branch>` ONLY if merged into main. If unmerged, skip and surface a `**⚠️ Skipped — unmerged branch**` `[!WARNING]` callout. Never use `-D` automatically.
4. **Worktree prune** — after removals: `git worktree prune` to clean up any stale references.

For sessions with **stack members**, branch deletion (step 3) iterates the stack **bottom-up** and refuses to delete any branch whose parent (position N-1) is still `OPEN`:

```bash
# stack ordered by stackPosition asc (parents first)
for member in "${stack_members[@]}"; do
  parent_state=$([ "$pos" -eq 1 ] && echo "MERGED" || gh_state "$parent_url")
  child_state=$(gh_state "$member_url")
  if [ "$child_state" = "MERGED" ] && [ "$parent_state" = "MERGED" ]; then
    git branch -d "$member_branch"
  else
    echo "Keep $member_branch — child=$child_state parent=$parent_state"
  fi
done
```

`--per-repo` is the escape hatch for the "child merged out of order" case — it bypasses the parent-merged check and deletes the child branch anyway. Use sparingly; only when you intend to abandon the unmerged parent.

For workspace-mode sessions, repeat steps 1–4 **per repo** in `repos`:

- For each repo `r`: `cd "$ORC_WORKSPACE_ROOT/$r"`, then `rm -rf .orc/<branch>/` (per-repo state, including the `workspace-link.json` back-pointer), `git worktree remove <perRepoState[$r].worktree>` (clean), `git branch -d <perRepoState[$r].branch>` (merged), `git worktree prune`.
- Then clean the workspace-level state: `rm -rf $ORC_WORKSPACE_ROOT/.orc/<branch>/` and remove the session entry from `$ORC_STATE_DIR/orc.json`.
- With `--per-repo`: only remove from repos whose PR is `MERGED`; leave others' state intact and update the workspace registry to reflect the partial cleanup (`perRepoState[$r]` removed, `repos` array trimmed).

### Phase 7 — Report

Echo a summary (plain fenced block — reports stay plain, no callout):

```
Cleaned up: 2 / 3 candidates

✓ feat-142-notifs (workspace, worktree, branch)
✓ fix-cache-stale (workspace only — worktree had uncommitted changes; branch unmerged)
⊘ refactor-billing (skipped — still in_progress)

Untouched worktrees:
  ../wt-fix-cache-stale  (3 dirty files — review before deleting manually)

Untouched branches:
  fix-cache-stale  (not merged into main — review before `git branch -D <name>`)
```

## Safety rules (all non-negotiable)

- **No `--force` on dirty worktrees.** A worktree with uncommitted changes contains user work. Skip and surface — never delete.
- **No `git branch -D` (capital D).** Only `-d` (lowercase, refuses unmerged branches). The user must use `-D` manually if they really mean it.
- **No deletion when running from inside a candidate.** Refuse and tell the user where to `cd` first.
- **`.orc/orc.json` updates are atomic.** Read, modify in memory, Write the full file. Never partial.
- **`--dry-run` always prints the plan and exits.** Even if the user confirms during the AskUserQuestion before realizing they should have used `--dry-run`, treat the flag as a final gate.
- **Stack child branches respect parent merge state.** A stack member at position N is only deletable if positions 1..N-1 are all `MERGED`. Bypassed only by `--per-repo` (with explicit consent).

## When to invoke

Most natural:

- After `/orc:ship` opens a PR and the PR merges in GitHub.
- When `/orc:status` shows multiple stale `completed` sessions cluttering the registry.
- After abandoning a feature (mark the session `abandoned` in `.orc/orc.json` first, then run `/orc:cleanup --all-completed` includes abandoned).

## Output

- Updated `.orc/orc.json` (with cleaned entries removed)
- Removed `.orc/<branch>/` directories
- Removed worktrees (where safe)
- Deleted local feature branches (where merged)
- A summary echoed to the user with anything left undone and why
