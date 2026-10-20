<!-- orc:qa/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Browser QA (web mode only)

1. Invoke `orc:browser-qa`.
2. Execute its protocol end-to-end, in the order below.
3. Add nothing to the protocol.
4. Confirm the driver wrote `qa-manifest.json` into the packet dir.

Protocol order (`orc:browser-qa`):

- Step 0 — target resolution (`orc:qa-targets`).
- Step 1 — env attach or provision for local targets.
- Step 1b — the driver gate; `--driver`, `--target` or a settled decision skips it.
- Step 2 — the acceptance-criteria load, all drivers.
- Then Driver P (Playwright, default), Driver A (validator dispatch) or Driver B (Claude-in-Chrome inline).

NOTE: the skill is the single source of truth, shared with `/orc:flow` Phase 6. This command adds nothing to it. In workspace mode the target is the one repo picked in Phase 0.
