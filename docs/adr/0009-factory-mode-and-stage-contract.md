# 0009 — Factory mode and the stage contract

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** maintainer

## Context

orc assumes a person in the session: every gate is an `AskUserQuestion`, every command ends in a prompt, and state lives in `.orc/` on that person's disk. Hardness (the tui-harness machine) runs the same loop without a person. It owns the queue, the board, the sandbox and the budget; it needs a worker that does one stage of work per call, never asks a question, and reports a result a program can read.

Two ways to get that worker are wrong. Hardness could re-implement orc's prompts and rules in its own repo, which forks the discipline (TDD, evidence, iron rules) and drifts. Or orc could grow its own queue, runner and board, which duplicates Hardness and widens orc past a plugin. The seam must carry orc's behaviour into Hardness's sandbox without either side owning the other's job.

## Decision

Hardness is the controller. orc is a library of stages that a controller calls.

- **Factory mode.** `ORC_FACTORY=1` marks a run with no human. `orc:gates` section 8 changes every gate: `AskUserQuestion` is never called; a soft-inward gate reads a settled decision or ends the stage with `needs_input` (at most 3 `{question, recommended}` items, `recommended` mandatory); a hard-outward action (tracker write, PR review post, evidence publish, `gh pr create`) is never performed and goes to `requested[]` for the board to approve; an escalation-only condition ends the stage with `escalated` (stage output schema 2; `fail` for a pack with no `escalated` answer kind). Iron rules and hooks apply unchanged. The interaction policy resolves to `auto (factory)`, and the SessionStart banner shows `mode: factory`.
- **Stage packs are data.** `orc/factory/stages.json` holds one pack per Hardness stage (`triage`, `test_design`, `implementing`, `verifying`, `e2e`, `evidence`, `ci_watch`, `reviewing_memory`): the agent or script, the skills it preloads, a tool allow-list copied verbatim from that agent's frontmatter, turn and time limits, and an output schema. The prompt for each pack is a template under `orc/factory/prompts/`. `ORC_FACTORY_STAGES` points at another packs file for tests.
- **`orc-stage` is the one entry.** `orc-stage packs | validate | render | run`. `run` calls the Agent SDK through `lib/factory/run.mjs`. `verify-factory.sh` and `verify-stage.sh` check the packs, the schemas and the verbs in CI.
- **The run folder is the contract.** Hardness writes `/in/stage.json` (schema 1: stage, pack, attempt, task, plan, decisions, prior findings, context, limits, env). orc writes `/out/result.json` (schema 1: ok, outcome, summary, needsInput, requested, findings, artifacts, slices, commit, usage, error), `/out/events.jsonl` and `/out/files/**`. The schemas live in `orc/factory/schema/`. Neither side changes a field without bumping `schema`.
- **Variant A is the seam.** The stage container loads the orc plugin through the SDK `plugins` option, restricts tools to the pack's list, and sets `settingSources: []` so no user or project settings leak in. The PreToolUse guards, skills and agents then run exactly as they do interactively. **Variant B is the fallback:** if the spike shows the plugin does not load or its guards do not fire in the container, `orc-stage render` output is sent as a plain prompt with no plugin. Variant B keeps the contract and loses the hooks.
- **Postgres is the source of truth.** Hardness keeps task, stage and artifact state in its database. `.orc/` is working state inside one stage run and is discarded with the container. `orc-state close --merged` and `orc-report factory` give the machine the two facts it needs from orc's side: a session closed by merge, and metrics in the shape Hardness's `GET /metrics` shares.
- **One-way intake.** `/orc:triage` sends a `ready-for-agent` issue to `POST <factory.machineUrl>/tasks` behind a hard-outward gate. The machine de-duplicates on `source`.

## Alternatives considered

### Option A — orc as the controller
- Rejected: needs a queue, a sandbox, a board and a budget, all of which Hardness already has. orc stays a plugin.

### Option B — prompts inlined into Hardness
- Rejected: forks orc's rules. A fix to a gate or an agent would land in two repos, and the guard hooks would not run.

### Option C — plain-text gates (parse the model's prose for questions and requests)
- Rejected: a controller cannot act on prose. The schema makes `needs_input` and `requested[]` checkable, and the evals grade for them.

## Consequences

- **Positive:** one copy of the discipline; the controller sees only typed results; stage packs are reviewable data with CI checks; a human flow and a factory run share every skill and hook.
- **Negative:** two repos share a frozen contract and must move together; every outward action in factory mode costs a board round trip; variant A depends on the plugin loading in the container, which the spike must confirm.
- **Sandbox hardening (Hardness PR #1):** the stage container runs with a read-only root filesystem, a tmpfs `/tmp`, `no-new-privileges`, and locked test files: after the implementing pack passes, a test file modified, deleted or renamed since the stage input commit fails the stage and resets the commit. Added tests pass; `kind: "test_change"` is the escape hatch. When the worktree is read-only, orc keeps its state on tmpfs (`ORC_STATE_DIR` under `$TMPDIR`) and `HOME` falls back to `$TMPDIR`.
- **Stage output schema 2:** adds `outcome: "escalated"`, for an agent that stops on purpose; `answer.reason` and `answer.options` carry the why. Before it, `run.mjs` reported an escalated implementer as `pass`, and the controller verified an empty change. Controllers read schema 1 and 2.
- **Neutral:** interactive use is unchanged. Without `ORC_FACTORY=1` no code path in this ADR runs.

## Follow-ups

- [ ] Spike 1 (tui-harness): orc plugin inside a stage container; record go (variant A) or no-go (variant B).
- [ ] Hardness side: contracts, runner image with orc, ingest and poller against the same schemas.
- [ ] Name the three `requested[].kind` values in `orc:gates` section 8; today only the output schema lists them.
