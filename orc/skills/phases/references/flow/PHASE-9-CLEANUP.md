<!-- orc:flow/P9 -->
# /orc:flow — Phase 9-CLEANUP

_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._


After merge in GitHub, the user re-invokes `/orc:flow` and orc detects `gh pr view <ref> --json state` returns `merged`. Then run `/orc:cleanup` logic for this session:

- Tear down the Docker environment if `docker-env-state.json` exists (execute its `teardownCommand` BEFORE removing state — the state file holds the command; volumes kept unless `--down-volumes`)
- Remove `.orc/<branch>/`
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

Before the cleanup plan runs, offer the retro — a soft-inward gate (`orc:gates` §6: auto-advances to *skip* under `guided`/`full`, asks under `manual`): **Run `/orc:retro` on this session first?** The retro reads `.orc/<branch>/files/` (usage ledger, slice history, escalations), which cleanup is about to delete, so it has to come first. On yes, run `/orc:retro --session <branch>` and return here when it closes.

After cleanup: mark `.orc/orc.json` entry `status: completed`, echo a summary.

