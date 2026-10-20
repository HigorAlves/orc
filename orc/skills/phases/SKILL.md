---
name: phases
description: Per-phase playbooks for orc commands, loaded one phase at a time. Use only from a command — entering phase N, Read exactly references/<command>/PHASE-<N>-*.md; never ahead, never from memory.
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
| `/orc:flow` | [P2 RFC](references/flow/PHASE-2-RFC.md) · [P3 Plan](references/flow/PHASE-3-PLAN.md) · [P4 Start](references/flow/PHASE-4-START.md) · [P5 Implement](references/flow/PHASE-5-IMPLEMENT.md) · [P6 QA](references/flow/PHASE-6-QA.md) · [P7 Ship](references/flow/PHASE-7-SHIP.md) · [P8 Address](references/flow/PHASE-8-ADDRESS.md) · [P9 Cleanup](references/flow/PHASE-9-CLEANUP.md) |
| `/orc:code-review` | [P1 Scope](references/code-review/PHASE-1-SCOPE.md) · [P3 Dispatch](references/code-review/PHASE-3-DISPATCH.md) · [P4 Merge](references/code-review/PHASE-4-MERGE.md) · [P5 Compose](references/code-review/PHASE-5-COMPOSE.md) · [P6 Post](references/code-review/PHASE-6-POST.md) · [P8 Summary](references/code-review/PHASE-8-SUMMARY.md) · [Audit](references/code-review/AUDIT.md) |

Phase 0 (context detection, state registration) always lives in the command and runs on every invocation.
