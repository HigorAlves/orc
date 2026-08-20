---
name: flow-phases
description: Per-phase playbooks for /orc:flow Phases 2–9, loaded one at a time as the flow reaches each phase. Use only from /orc:flow — Read the single references/PHASE-N-*.md for the phase being entered, never all of them.
---

# Flow Phases

The phase bodies of `/orc:flow`, disclosed progressively — the command's entry point carries routing, triage, and the gates; each phase's full playbook loads only when the flow reaches it.

**Protocol:** entering phase N → `Read` exactly `references/PHASE-<N>-<NAME>.md`, then execute it. Never run a phase from memory, never read phases ahead of the one being entered, and never read a phase the run skips.

| Phase | File |
|-------|------|
| 2 — RFC (optional) | [PHASE-2-RFC.md](references/PHASE-2-RFC.md) |
| 3 — Plan | [PHASE-3-PLAN.md](references/PHASE-3-PLAN.md) |
| 4 — Start (worktree + failing test) | [PHASE-4-START.md](references/PHASE-4-START.md) |
| 5 — Implement (orc-implementer batches) | [PHASE-5-IMPLEMENT.md](references/PHASE-5-IMPLEMENT.md) |
| 6 — QA | [PHASE-6-QA.md](references/PHASE-6-QA.md) |
| 7 — Ship | [PHASE-7-SHIP.md](references/PHASE-7-SHIP.md) |
| 8 — Address | [PHASE-8-ADDRESS.md](references/PHASE-8-ADDRESS.md) |
| 9 — Cleanup | [PHASE-9-CLEANUP.md](references/PHASE-9-CLEANUP.md) |

Phases 0–1 (context detection, triage, the sprint contract) live in the command itself — they run on every invocation.
