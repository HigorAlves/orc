# 0010 — Factory mode retired

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** maintainer
- **Supersedes:** [ADR 0009](0009-factory-mode-and-stage-contract.md)

## Context

ADR 0009 made orc a library of stages for a controller: `ORC_FACTORY=1`, `orc-stage run`, stage packs under `orc/factory/`, a run-folder contract shared with the Luna TUI machine, and gates that ended a stage with a typed result instead of asking. In practice the seam carried less than it promised: the Agent SDK runner never loaded the agent bodies, never applied the agents' model and effort, and preloaded no skills; only the bash guards and the session banner reached the stage. The two repositories had to move together and drifted.

Luna TUI now owns its stages ([luna-tui PR #65](https://github.com/HigorAlves/luna-tui/pull/65)): the roles, prompts, skills, guards and the SDK runner live in that repository, copied from orc once under the MIT licence and maintained there. Nothing calls factory mode anymore.

## Decision

Remove factory mode from orc. orc is an interactive Claude Code plugin again, nothing else.

- Deleted: `orc/factory/`, `orc/lib/factory/`, `orc/lib/stage.sh`, `orc/bin/orc-stage`, the `orc-verifier` agent (only the verifying pack dispatched it), the two factory evals, `verify-factory.sh`, `verify-stage.sh` and their fixtures, `orc-report factory`, the `## Factory` tracker key and the "Send to the factory" option in `/orc:triage`.
- Removed from the shared pieces: `orc:gates` section 8, the `ORC_FACTORY` branches in `workspace-detect.sh` and the session-start banner, the factory notes in `orc:using-orc`, `orc:project-context`, `orc:state-protocol` and the retro's propose phase.
- Kept: `orc-state close --merged` (useful on its own once a PR merges) and the project-context layer (`docs/agents/project-context.md`), which interactive executors still preload.

## Consequences

- One fewer agent and one fewer bin; the counts in README, marketplace and architecture move with them.
- A repo that still carries a `## Factory` section in `docs/agents/issue-tracker.md` is not read anymore; the section is harmless and can be deleted.
- Luna TUI takes tickets through its board and its GitHub poll loop. Any HTTP client can still post to its `/tasks` route; orc no longer ships one.
