<!-- orc:retro/P1 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 1 — Primary sources

Read the session itself, never a summary of it. Sources in order of signal:

1. Read the session files under `${ORC_STATE_DIR}/<branch>/files/` (list below).
2. Run `orc-state usage summary` for per-agent tokens and wall time, costliest first.
3. Run `git log --no-merges <base>..HEAD` for the branch.
4. Read the current conversation, or `--transcript <path>` when given.
5. Read the repo's own guardrails (list below).
6. If no session state exists, say so and work from the conversation and git log.

Session files:

- `checkpoint.md` — phases, digest.
- `progress.md` — the slice-by-slice history.
- `slices.json` — which slices went red more than once, which escalated.
- `diagnosis.md`, `qa/steps.md`, `review-findings.json`.

Git log evidence: commit count, fixups, reverts, "retry" subjects.

Guardrails: the `lint`, `check` and `test` scripts in `package.json` or the build tool; the pre-commit config; the CI workflows.

NOTE: read the guardrails before proposing a check. A check that exists but sits unwired or silently broken is the finding, not a reinvention.
