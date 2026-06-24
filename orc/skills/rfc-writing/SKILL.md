---
name: rfc-writing
description: Author RFCs — design docs that propose a non-trivial change before implementation, surface alternatives, and invite critique, in docs/rfcs/NNNN-*.md. Use for "write an RFC" or a multi-team feature.
---

# RFC Writing

> **Defer to `orc:doc-writing`** for the shared scaffolding: the doc-type map (RFC vs PRD vs TRD vs ADR vs postmortem, and how RFCs differ from plans and ADRs), the shared section outline, the `docs/<type>s/NNNN-*.md` numbering & publication convention, and the review gates. This skill carries only the RFC-specific template, process, and tone.

RFCs make design decisions visible BEFORE code commits to them. They cost a few hours of writing to save days of misaligned implementation.

## When to write one

Write an RFC when **any** of these are true:

- The change touches **multiple components/services** that are owned by different teams or have separate release cadences.
- The implementation cost is **≥ 2 weeks** of engineering effort.
- The decision will **lock in technology, protocol, or interface** that others must conform to.
- A clear alternative exists and **you're not sure which is better** (the RFC is how you find out).
- A teammate is on a different mental model than you and one of you is wrong.

Don't write an RFC for:
- A single file/module change inside one team's scope
- Work that has clear precedent in the codebase already
- Something you'd implement in a day even if wrong

## Template

```markdown
# RFC NNNN — <One-line problem statement>

- **Author:** <name>
- **Status:** Draft | In Review | Approved | Rejected | Superseded
- **Created:** YYYY-MM-DD
- **Discussion:** <link to PR or thread, if applicable>
- **Decision deadline:** YYYY-MM-DD  (when feedback closes)

## Summary

Two-to-three sentences. What's being proposed and why now. A reader who reads only this paragraph should know whether to keep going.

## Goals

Bulleted list of what the proposal MUST accomplish. Be specific — measurable if possible.

- ...
- ...

## Non-goals

What this proposal explicitly does NOT do. Goes a long way toward heading off scope creep in review comments.

- ...
- ...

## Background / Context

What's the world look like today? What constraints (latency, scale, team capacity, vendor lock-in, regulatory) bound the design space? Cite real numbers. Link to dashboards, prior incidents, or earlier ADRs that bear on this decision.

## Proposed design

This is the core. A reviewer should be able to estimate the implementation effort from this section alone.

Suggested subsections:

### High-level shape
ASCII diagram or component listing. What gets added, what gets modified, what gets removed.

### Key interfaces / data shapes
Function signatures, schema changes, API endpoints — the public-facing edges.

### Failure modes & invariants
What happens when X breaks? What invariants must hold? What's the worst-case behavior?

### Migration / rollout
If this changes existing behavior: how do we get from here to there safely? Backwards-compatible? Two-phase deploy? Feature flag?

## Alternatives considered

Each alternative gets a subsection. For each:

- The shape of the alternative
- Why it was rejected (specific, non-rhetorical reasons)

Include "keep doing what we do" as an alternative — answering "why now?" is often where RFCs collapse.

## Open questions

Bullets the author wants reviewer input on:

- Q1: ... (preferred answer: ..., but uncertain)
- Q2: ...

## Risks & unknowns

What could go wrong that the design doesn't address? What evidence would change the recommendation?

## Success criteria

How do we know this RFC's implementation is successful 3 months in? Be measurable: latency p95, error rate, incident count, developer velocity, adoption rate.

## Appendix (optional)

- Benchmark results
- Prior-art links
- Glossary
```

## Process discipline

1. **Draft alone first.** A blank RFC reviewed by 5 people becomes design-by-committee; an opinionated draft sharpens the conversation.
2. **Set a decision deadline.** RFCs without a deadline drift indefinitely. 1 week for small RFCs, 2 weeks for big ones.
3. **Revise the document, not the comments.** If a reviewer's feedback changes the design, edit the design and resolve the comment. The final document should read as if the conversation never happened.
4. **Approval ≠ implementation.** When approved, follow-up issues / `/orc:plan` produce the work breakdown. The RFC is the *why*; the plan is the *how*.
5. **Reject is fine.** A rejected RFC is a successful one — the team learned that approach was wrong without paying for the implementation. Mark it Rejected, leave the document, link from future ADRs that benefit from the analysis.

An RFC that gets approved typically spawns 1–N ADRs (one per durable decision it locks in) and 1 plan (work breakdown).

## Tone

Engineer-to-engineer, plain prose. Bullet over prose where it helps. Diagrams where 200 words of prose would otherwise be needed. Cite teammates by role rather than name where decisions are organizational ("the security team requires …" rather than "@alice said …"). No marketing voice. No "obvious" or "trivial" — if it were obvious, no RFC needed.

## What to do as the model

1. Apply the "any of these are true" test. If the user is asking for an RFC for something too small, push back gently and suggest a plan or a single-paragraph design note instead.
2. Locate `docs/rfcs/` (create if needed) and find the next sequence number — see the numbering convention in `orc:doc-writing`. RFCs may also live in an external tool when discussion threading matters more than diff history (see publication notes in `orc:doc-writing`).
3. Draft from the template. Fill `Goals` and `Non-goals` first — they bound the rest.
4. Default `Decision deadline` to 1 week from today; user can adjust.
5. After draft, surface to the user (review gates in `orc:doc-writing`), ask whether to commit or open a discussion thread first.
