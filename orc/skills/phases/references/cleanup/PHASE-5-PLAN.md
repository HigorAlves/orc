<!-- orc:cleanup/P5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 5 — Preview the plan, then confirm

1. Print the danger callout below.
2. Print the plan in a fence (template below); the ✓/⚠/⊘ lines stay inside the fence.
3. If a session has stack members, add the stack block.
4. If the orphan sweep found any, add the orphaned-environments block.
5. Ask via `AskUserQuestion` with the three options below.
6. If `--dry-run`, print the plan and exit, whatever the answer; never apply.

Danger callout:

```markdown
> **🛑 Destructive preview**
>
> The plan below removes workspace state, worktrees, and branches. Skipped items (⚠/⊘) stay untouched.
```

Plan:

```
Will clean up:

[feat-142-notifs]
  ✓ docker compose -p orc-myapp-feat-142-notifs down   (volumes kept — --down-volumes to remove)
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

Stack block (when a session has stack members):

```
[feat-export]   stack <stackId> (3 PRs, bottom-up)
  ✓ 01 api#311  MERGED  → branch feat/export/01-... deletable
  ✓ 02 api#312  MERGED  → branch feat/export/02-... deletable (parent merged)
  ⊘ 03 ui#447   OPEN    → keep until merge
     · child branches stay (waiting for #447)
```

Child `MERGED` while its parent is still `OPEN` (rare: a fold or an out-of-order merge):

```
  ⚠ 03 ui#447   MERGED  → branch DEFERRED — parent #312 still OPEN
     · pass --per-repo to delete the child branch out of order
```

Orphaned-environments block (when the sweep found any):

```
Orphaned orc environments (no registered session):
  ⚠ orc-zzz-old-branch   (2 containers running)
     · not auto-removed — include in plan? (per-item choice in "Edit plan")
```

`AskUserQuestion` options:

- "Proceed — apply the plan as shown"
- "Edit plan — pick individual items to skip"
- "Cancel"
