# /orc:flow — Phase 7-SHIP

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


Invoke `/orc:ship` logic. The **size gate runs exactly once — inside ship's Phase 4.5** (never pre-flight it here; `ship.md` owns the gate and its "Stack from plan slices" option lights up automatically when this session has a plan whose commits map 1:1 to slices). Pass through `--max-loc` / `--no-size-gate` / `--verbose` / `--draft` unchanged.

Flow-specific deltas from standalone `/orc:ship`:

- **Skip `orc:finishing-a-development-branch`.** The flow's premise is already "open a PR" — merge-directly / keep-working / discard stay reachable via Abort at any remaining gate. (Standalone `/orc:ship` keeps that phase; its intent is genuinely unknown there.)
- `orc:requesting-code-review` (gap check vs the plan)
- `orc:git-commit` (if uncommitted)
- PR composition: `orc:caveman-pr` by default; the long-form template only if `--verbose` was passed
- `gh pr create` — UNLESS this repo stacked in the size gate, in which case `/orc:stack-pr` already opened the PRs and Phase 7 only records the stack metadata in `linkedPRs`.

Per-repo size-gate decisions are independent: in workspace mode, repo `api` can stack while `ui` opens single with an override. Record each decision in `checkpoint.md` (so `/orc:resume` knows we already gated this repo).

In workspace mode, `/orc:ship` opens **N PRs** — one per target repo — and second-passes each with `gh pr edit` to inject a "Linked PRs" cross-link block + merge order from the plan. Captured PR URLs are written into the workspace registry's `linkedPRs` array (with `stackId`/`stackPosition`/`stackedOn` populated for repos that stacked).

```
AskUserQuestion (after PR composed):
- Open as-is
- Edit title/body first
- Open as draft
- Cancel
```

**Post-open CI gate.** Once the PR(s) are open, watch CI before advancing: `gh pr checks <pr> --watch` (fallback: `gh run watch` on the head branch's newest run). In workspace mode, watch every PR in `linkedPRs`.

- **Green** → record `ci: green` in `checkpoint.md` and advance to Phase 8.
- **Red** → dispatch `orc-ci-investigator` via `Task` with the PR ref + head SHA, save its report verbatim to `${ORC_STATE_DIR}/<branch>/files/ci-diagnosis.md` (Write, never echoed), then invoke **`orc:ci-routing`** and execute its protocol — the single source of truth shared with `/orc:ci` Phase 3. Loop until green or the user explicitly advances with red CI (logged to the digest).

