# Shared section outline

Disclosed from `orc:doc-writing`. Read when a type's template needs a section it does not define, or when checking a draft against the common spine.

Most of these docs share a backbone. A given type adds or drops sections (see its skill), but the spine is:

1. **Header / metadata block** — title (`<TYPE> NNNN — <noun-phrase title>`), Status, Author/Deciders, dates, and links to related PRDs/RFCs/ADRs/tickets.
2. **Summary** — 2–3 sentences; a reader who reads only this knows whether the doc concerns them.
3. **Goals** — what this doc MUST accomplish/enable. Bulleted, specific, measurable where possible.
4. **Non-goals / Out of scope** — explicit exclusions. This is load-bearing: without it, every reviewer pastes in their pet feature and the work doubles.
5. **Background / Context** — what the world looks like today, and the constraints (latency budget, scale, regulatory, capacity, vendor lock-in, deadline) that bound the work. Cite real numbers; link to prior docs / dashboards / incidents.
6. **Body** — the type-specific core (proposed design, technical contract, the decision, the timeline, etc.). This is where the types diverge most.
7. **Risks & open questions** — what could derail the work, and what the author needs reviewer input on. State a preferred answer where you have one.
8. **Success criteria** — how we'll know, measurably, that this worked (latency p95, error rate, adoption, action-items-closed).
9. **Appendix (optional)** — benchmarks, prior art, mockups, glossary.

Fill every section with real content. **Delete a section that genuinely has no content — never leave `TBD` or a stub placeholder.** An empty section is a lie about being thought through.
