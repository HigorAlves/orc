<!-- orc:stack-pr/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Preview and confirm

1. Write the slice and rebase plan to `${ORC_STATE_DIR}/<sanitized-branch>/files/stack-plan.json` before the gate.
2. Stamp it with `headSha` and `generatedAt` (`orc:state-protocol`).
3. Print the preview headline below.
4. If `--smart`, print the analyzer warnings as a `⚠️ Caution` callout after it.
5. Ask with `AskUserQuestion`, header `Stack plan`, the stack table as the Approve option's `preview`.
6. On "Edit", open the slice JSON in `$EDITOR`.
7. After save, re-validate the JSON and return to step 3.
8. On "Cancel", stop.

NOTE: an interrupted run restacks or re-previews from `stack-plan.json` without re-dispatching `orc-stack-analyzer`. No separate fence for the table; tables never go inside callouts (`orc:gates` §3).

Preview headline:

```markdown
> **📋 Preview — stack plan**
>
> 3 PRs from feat/export, base = origin/main — 315 LOC total (avg 105 LOC/PR, all under 300 budget).
```

Preview payload (the stack table):

```
| # | Branch                                       | Subject                                      | LOC | Commits |
|---|----------------------------------------------|----------------------------------------------|-----|---------|
| 1 | feat/export/01-refactor-extract-row-stream   | refactor: extract row-stream interface       |  80 | 2       |
| 2 | feat/export/02-feat-wire-export-job          | feat(api): wire export job through stream    | 140 | 1       |
| 3 | feat/export/03-feat-download-button          | feat(ui): download button + progress         |  95 | 1       |
```

`--smart` only, analyzer warnings after the table:

```markdown
> **⚠️ Caution**
>
> - Commit e4f5g6h modifies one line in ExportJob.ts (slice 2). Proposed as-is.
```

`AskUserQuestion` options (header `Stack plan`):

1. **Approve (Recommended)** — execute the rebase plan. `preview`: the stack table.
2. **Edit** — open the slice JSON in `$EDITOR`; re-validate after save.
3. **Cancel.**
