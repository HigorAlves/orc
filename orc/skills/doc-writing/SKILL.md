---
name: doc-writing
description: "Shared scaffolding for numbered design/spec docs — outline, NNNN-* numbering, review gates, doc-type map (PRD/TRD/RFC/ADR/postmortem). Referenced by orc:prd/trd/rfc/adr-writing + postmortem."
---

# Doc Writing — shared scaffolding

This skill holds the material common to every numbered design/spec document orc authors. The five type-specific skills — `orc:prd-writing`, `orc:trd-writing`, `orc:rfc-writing`, `orc:adr-writing`, `orc:postmortem` — defer here for the shared parts and add only their own template, fields, and tone.

Read this first when authoring any of those docs. It answers: **which doc type is this?**, **how is it laid out?**, **where does it get published?**, and **what are the review gates?**

## The doc-type map — which one is this?

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

## Where docs live — numbering & publication

Numbered docs follow one convention across the project:

```
docs/<type>s/NNNN-<kebab-name>.md
```

- `docs/prds/`, `docs/trds/`, `docs/rfcs/`, `docs/adr/` (note: `adr`, singular dir name by convention).
- `NNNN` is a **four-digit zero-padded** sequence: `0001`, `0002`, … .
- The sequence is **monotonic across the project** — never reuse a number, even for archived / superseded / rejected docs.
- Find the next number mechanically:
  ```
  ls docs/<type>s 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1
  ```
  then increment and re-pad to four digits.
- If `docs/<type>s/` doesn't exist yet, **create it** and add a one-line `docs/<type>s/README.md` pointing at the relevant type skill.

**Postmortems are the exception** — they're keyed by incident date, not a monotonic counter: `docs/postmortems/YYYY-MM-DD-<short-slug>.md`.

**External-tool publication.** RFCs and postmortems may live in an external tool (Notion, Confluence, Linear, GitHub Discussions) instead of in-repo — use that when reviewers don't clone the repo, or when threaded discussion / non-engineering read access matters more than diff history. For orc projects, **default to in-repo**; move external only when the discussion volume or audience justifies it.

**Cross-linking.** Link *from* the related artifacts (tickets, PRDs, code comments) *to* the new doc, so the doc is the entry point — not the reverse.

## Shared section outline

Most of these docs share a backbone. A given type adds or drops sections (see its skill), but the spine is:

1. **Header / metadata block** — title (`<TYPE> NNNN — <noun-phrase title>`), Status, Author/Deciders, dates, and links to related PRDs/RFCs/ADRs/tickets.
2. **Summary** — 2–3 sentences; a reader who reads only this should know whether the doc concerns them.
3. **Goals** — what this doc MUST accomplish/enable. Bulleted, specific, measurable where possible.
4. **Non-goals / Out of scope** — explicit exclusions. This is load-bearing: without it, every reviewer pastes in their pet feature and the work doubles.
5. **Background / Context** — what the world looks like today, and the constraints (latency budget, scale, regulatory, capacity, vendor lock-in, deadline) that bound the work. Cite real numbers; link to prior docs / dashboards / incidents.
6. **Body** — the type-specific core (proposed design, technical contract, the decision, the timeline, etc.). This is where the types diverge most.
7. **Risks & open questions** — what could derail the work, and what the author needs reviewer input on. State a preferred answer where you have one.
8. **Success criteria** — how we'll know, measurably, that this worked (latency p95, error rate, adoption, action-items-closed).
9. **Appendix (optional)** — benchmarks, prior art, mockups, glossary.

Fill every section with real content. **Delete a section that genuinely has no content — never leave `TBD` or a stub placeholder.** An empty section is a lie about being thought through.

## Review gates

Discipline shared across all five types:

1. **Confirm the doc type is warranted** before drafting — apply the "when to write one" test in the type's skill. If borderline, surface the call (this type / a smaller artifact / nothing).
2. **Draft alone first.** A blank doc reviewed by five people becomes design-by-committee; an opinionated draft sharpens the conversation.
3. **Bound it before filling it.** Write Goals and Non-goals first — they constrain everything below.
4. **Show the draft to the user before committing.** Use `AskUserQuestion` with options like "Looks good — commit" / "Edit before commit" / "Save as Draft (status flag flipped)".
5. **Revise the document, not the comments.** When a reviewer's feedback changes the doc, edit the doc and resolve the comment. The final doc should read as if the discussion never happened.
6. **Move the Status.** A doc stuck in `Draft` / `Proposed` forever is a smell — either advance it (In Review → Approved/Accepted) or archive it. Don't let docs rot in their initial status.
7. **Commit** via `orc:git-commit`. Suggested message shape: `docs(<type>): NNNN — <kebab title>`.
8. **Cross-link after acceptance** — from tickets, related docs, and any code the doc governs.

## Shared tone

Engineer-to-engineer (or product-minded-engineer-to-product-and-engineering for PRDs), plain prose. Bullets and tables where they add precision; diagrams where 200 words of prose would otherwise be needed. **No marketing voice** ("delight", "seamless", "best-in-class"). **No "obvious" or "trivial"** — if it were obvious, you wouldn't be writing the doc. Cite constraints by name (latency budget, deadline date, vendor SLA, named stakeholders by role). When a driver is non-technical (legal, vendor relationship, exec mandate), say so plainly — the future reader needs that context. Be honest about negatives and unknowns; a doc with no downsides is a sales pitch, not a record.
