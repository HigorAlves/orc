# /orc:flow — Phase 9-CLEANUP

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


After merge in GitHub, the user re-invokes `/orc:flow` and orc detects `gh pr view <ref> --json state` returns `merged`.

## Retro first — cleanup destroys the inputs

`.orc/<branch>/files/` is exactly what `/orc:retro` reads: the ledger with estimates against actuals, `qa-verdict.json`, `review-findings.json`, `readiness.json`, `progress.md`. Cleanup deletes all of it. **Retro-then-cleanup is the only workable order.**

Offer it before the cleanup preview:

```
AskUserQuestion:
- Run /orc:retro first — recommended when the session had escalations, a
  waived CONCERNS, repeated review findings, or estimates that missed badly
- Skip — nothing to learn here
```

Declining is one keystroke and the flow continues. Never run the retro without asking: its deltas rewrite the layer that directs every future agent in the repo, and that gate stays human at every autopilot level.

When accepted, `/orc:retro` runs to completion (including applying accepted deltas) before cleanup proceeds.

## Then clean up

Run `/orc:cleanup` logic for this session:

- Tear down the Docker environment if `docker-env-state.json` exists (execute its `teardownCommand` BEFORE removing state — the state file holds the command; volumes kept unless `--down-volumes`)
- Remove `.orc/<branch>/` (never `.orc/project-context.md` or `.orc/knowledge/` — those are per-repo and outlive every branch)
- Remove worktree (if clean)
- Remove local branch (if merged)
- Update central registry

In workspace mode, cleanup runs only when **every** PR in `linkedPRs` is merged (use `gh pr view` per URL). When some are merged and others are still open, surface that list and `AskUserQuestion`: wait, clean per-repo (using `--per-repo`), or abort. After all merge, clean each repo's worktree + per-repo `.orc/<branch>/` AND the workspace-level `<workspaceRoot>/.orc/<branch>/` together.

```
AskUserQuestion (preview the cleanup plan):
- Apply as shown
- Edit (skip individual items)
- Skip cleanup — keep state for now
- Abort cleanup
```

After cleanup: mark `.orc/orc.json` entry `status: completed`, echo a summary.

