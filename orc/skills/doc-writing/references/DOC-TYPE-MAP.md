# The doc-type map — which one is this?

Disclosed from `orc:doc-writing`. Read when choosing between PRD, TRD, RFC, ADR, postmortem and plan, or when the type-specific skill asks how its type differs from its neighbours.

These five document types form a lineage, each answering a different question at a different moment. Picking the wrong one wastes the reader's time and yours. Use this matrix to choose.

| Document | Primary question it answers | Audience | Stable / lives until |
|----------|----------------------------|----------|----------------------|
| **PRD** | "What are we building, for whom, and why?" | PM, design, engineering, leadership | Product intent locked in |
| **TRD** | "What's the technical contract — interfaces, data, failure modes?" | Engineering | Engineering agrees on the contract |
| **RFC** | "How should we build it? Which alternative wins?" | Engineering (sometimes wider review) | Decision made (Approved / Rejected) |
| **ADR** | "We decided X; here's why." | Future-you and successors | Forever (until superseded) |
| **Postmortem** | "What did this incident teach us about the system?" | Engineering, on-call, leadership | Final once all P0 action items close |
| **Plan** | "In what order do we ship the slices?" | Whoever is implementing | Work shipped |

A typical lineage: **PRD → TRD → (RFC if alternatives exist) → plan → ADRs as decisions lock in.** A postmortem is off to the side — it's triggered by a production incident, not by the build pipeline, and it often *spawns* ADRs and doc updates downstream.

### How each type is distinct

- **PRD vs TRD** — a PRD answers *what & why for the user*; a TRD answers *what we'll build, technically* (the interfaces, data shapes, failure modes). A PRD heavy with API shapes and schemas is a TRD mislabeled. A TRD with no PRD behind it is answering a question nobody asked.
- **TRD vs RFC** — a TRD *commits to one contract*; an RFC *debates alternatives*. Argument belongs in the RFC; the TRD records the contract that survived. A TRD that debates `pgbouncer vs. pgcat` is really an RFC.
- **RFC vs ADR** — an RFC is *exploratory and opens debate* before a decision; an ADR is the *durable, post-hoc record* of a decision already made. An approved RFC typically spawns 1–N ADRs (one per durable decision it locks in) plus one plan.
- **RFC/ADR vs plan** — RFC and ADR are about *the design and why*; a plan is *the ordered work breakdown* once design is settled. Don't write an RFC for something with clear precedent you'd implement in a day — write a plan or just do it.
- **Postmortem vs systematic-debugging** — `systematic-debugging` *fixes the bug*; the postmortem *learns from the system around the bug* (the gaps in tests, review, alerting, and process that let the bug reach production). The fix lands in code; the postmortem lands in the team's memory.
- **prd-writing vs orc:to-prd** — `prd-writing` authors a PRD *from scratch*, interview-driven, and publishes to `docs/prds/`. `orc:to-prd` *synthesizes an existing conversation* into a PRD shape and ships it to an issue tracker. "I have an idea, help me PRD it" → `prd-writing`. "We just talked this through; write it up" → `orc:to-prd`.

When the choice is genuinely borderline, surface the call to the user (e.g. "this could be a small RFC or just a plan — which do you want?") rather than guessing.
