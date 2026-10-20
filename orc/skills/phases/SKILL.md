---
name: phases
description: Per-phase playbooks for orc commands, loaded one phase at a time
when_to_use: Use only from a command — entering phase N, Read exactly references/<command>/PHASE-<N>-*.md; never ahead, never from memory.
---

# Phases

The phase bodies of orc's larger commands, disclosed progressively. A command's entry file carries its arguments, preconditions, Phase 0 and the phase index; each phase module loads only when the command reaches it.

## Protocol

1. Entering phase N, `Read` exactly `references/<command>/PHASE-<N>-<NAME>.md`.
2. Execute that file.
3. Never run a phase from memory.
4. Never read a phase ahead of the one being entered.
5. Never read a phase the run skips.

## Module code

The first line of every module is its code: `<!-- orc:<command>/P<N> -->`. Cross-references use the code ("per orc:flow/P5"), never prose like "the implement phase above".

## Modules

| Command | Modules |
|---|---|
| `/orc:flow` | [P2](references/flow/PHASE-2-RFC.md) · [P3](references/flow/PHASE-3-PLAN.md) · [P4](references/flow/PHASE-4-START.md) · [P5](references/flow/PHASE-5-IMPLEMENT.md) · [P6](references/flow/PHASE-6-QA.md) · [P7](references/flow/PHASE-7-SHIP.md) · [P8](references/flow/PHASE-8-ADDRESS.md) · [P9](references/flow/PHASE-9-CLEANUP.md) |
| `/orc:plan` | [P1](references/plan/PHASE-1-INIT.md) · [P2](references/plan/PHASE-2-DRAFT.md) · [P3](references/plan/PHASE-3-GRILL.md) · [P4](references/plan/PHASE-4-CONFIRM.md) · [P5](references/plan/PHASE-5-DECOMPOSE.md) · [DISCOVERY](references/plan/DISCOVERY.md) · [PRD](references/plan/PRD.md) · [REFACTOR](references/plan/REFACTOR.md) |
| `/orc:qa` | [P2](references/qa/PHASE-2-VERIFY.md) · [P3](references/qa/PHASE-3-REVIEW.md) · [P4](references/qa/PHASE-4-BROWSER.md) · [P5](references/qa/PHASE-5-VERDICT.md) · [P6](references/qa/PHASE-6-PUBLISH.md) · [PACKET](references/qa/PACKET.md) |
| `/orc:retro` | [P1](references/retro/PHASE-1-SOURCES.md) · [P2](references/retro/PHASE-2-CANDIDATES.md) · [P3](references/retro/PHASE-3-PRESENT.md) · [P4](references/retro/PHASE-4-ACT.md) |
| `/orc:ship` | [P1](references/ship/PHASE-1-VERIFY.md) · [P2](references/ship/PHASE-2-REVIEW.md) · [P3](references/ship/PHASE-3-COMPOSE.md) · [P4](references/ship/PHASE-4-GATE.md) · [P4.5](references/ship/PHASE-4.5-SIZE-GATE.md) · [P5](references/ship/PHASE-5-PUSH.md) · [P6](references/ship/PHASE-6-CLEANUP-HINT.md) |
| `/orc:stack-pr` | [P1](references/stack-pr/PHASE-1-TOOLING.md) · [P2](references/stack-pr/PHASE-2-PRECONDITIONS.md) · [P3](references/stack-pr/PHASE-3-ANALYZE.md) · [P4](references/stack-pr/PHASE-4-PREVIEW.md) · [P5](references/stack-pr/PHASE-5-EXECUTE.md) · [P6](references/stack-pr/PHASE-6-WRITEBACK.md) · [P7](references/stack-pr/PHASE-7-SUMMARY.md) · [SMART](references/stack-pr/SMART.md) |
| `/orc:triage` | [P1](references/triage/PHASE-1-QUEUE.md) · [P2](references/triage/PHASE-2-ITEM.md) · [P3](references/triage/PHASE-3-OVERRIDE.md) · [BRIEFS](references/triage/BRIEFS.md) · [OUT-OF-SCOPE](references/triage/OUT-OF-SCOPE.md) |
| `/orc:wayfinder` | [MAP](references/wayfinder/MAP.md) · [A](references/wayfinder/MODE-A-CHART.md) · [B](references/wayfinder/MODE-B-WORK.md) |

Phase 0 (context detection, state registration) always lives in the command and runs on every invocation.

Commands piloted as skill directories (ADR 0008: `code-review`, `cleanup`, `incident`) keep their modules under their own `references/` and follow the same protocol.
