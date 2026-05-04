---
name: adr-writing
description: Author and update Architecture Decision Records (ADRs) — the durable record of a technical decision and its trade-offs. Use when locking in a non-trivial architectural decision (database choice, framework choice, boundary lines, protocol choice, deprecation), when the user says "let's write this down" / "ADR for this" / "what was the decision on X", or when an existing ADR needs supersession.
---

# ADR Writing

ADRs are the contract between past-you and future-you. They capture *why* a decision was made, not just *what* was chosen, so a year later nobody has to reverse-engineer the trade-offs from code.

## When to write one

Write an ADR when **all** of these are true:

- The decision is **architectural** — affects multiple modules, defines a boundary, picks a technology, or sets a convention everyone follows.
- The decision is **non-obvious** — there were real alternatives, and another smart engineer might pick differently.
- The decision is **durable** — you expect it to live ≥ 3 months. Tactical tweaks don't deserve ADRs.

Don't write ADRs for:
- Library version bumps with no API impact
- Bug fixes
- Naming choices inside a single file
- Decisions you'll revisit next sprint

## Where they live

`docs/adr/NNNN-<kebab-decision-name>.md`, where `NNNN` is a four-digit zero-padded sequence (`0001`, `0002`, ...). Sequence is monotonic across the project — never reuse a number, even for superseded ADRs.

If `docs/adr/` doesn't exist yet, create it and add a one-line `docs/adr/README.md` pointing to this skill.

## Template

Every ADR uses this shape:

```markdown
# NNNN — <Decision title in noun phrase>

- **Status:** Proposed | Accepted | Superseded by NNNN | Deprecated
- **Date:** YYYY-MM-DD (when status was last updated)
- **Deciders:** <names or roles>

## Context

What is the situation that demanded a decision? What forces are at play (technical, organizational, regulatory)? Quote real numbers, real constraints, real deadlines. 1–3 paragraphs.

## Decision

The chosen approach, stated as a single declarative sentence. Then 1–3 paragraphs explaining how it works in this codebase.

## Alternatives considered

Each alternative gets a short subsection:

### Option A — <name>
- What it would look like
- Why it was rejected (one or two specific reasons)

### Option B — <name>
…

Include "do nothing" as an alternative if it was real.

## Consequences

What changes because of this decision?

- **Positive:** <what gets easier, safer, faster>
- **Negative:** <what gets harder, more brittle, more locked in>
- **Neutral:** <visible side-effects without strong polarity>

Be honest about negatives. An ADR with no negatives is a sales pitch, not a record.

## Follow-ups

- [ ] Concrete tasks unlocked by accepting this decision (link to issues/PRs).
- [ ] Open questions to revisit later, with a date.
```

## Status transitions

- **Proposed** — the decision is on the table; soliciting input.
- **Accepted** — the decision is in effect; the codebase is being shaped to match.
- **Superseded by NNNN** — a later ADR replaces this one. Never delete; mark superseded and link the successor.
- **Deprecated** — no successor, but no longer the way. Use sparingly.

When superseding, the new ADR's `Context` section MUST cite the predecessor and explain why the situation changed.

## Tone

ADRs are written by engineers, for engineers, in plain prose. No marketing voice. No "best practices" without a citation. Quote constraints (latency budget, deadline, headcount) by name. If a decision was driven by a non-technical reason (vendor relationship, exec mandate, customer contract), say so — the future reader needs that context.

## What to do as the model

1. Confirm with the user that an ADR is warranted (apply the "all of these are true" test above). If borderline, surface that and ask.
2. Find the next sequence number: `ls docs/adr | sort | tail -1` and increment.
3. Draft using the template, filling each section with real content. Don't leave placeholder text like "TBD" — if a section truly has no content, delete it rather than leave a stub.
4. Show the draft to the user for review before committing.
5. After acceptance, link the ADR from any code comment or doc that depends on the decision, so the link is the entry point not the reverse.

## Anti-patterns

- **Status: Proposed** that never moves. Either accept or close.
- ADRs with no `Alternatives considered` — that means the decision wasn't really made.
- ADRs written months after the decision was implemented — the negatives are usually missing because hindsight has filtered them.
- One-line decisions ("we use Postgres") — fine as a starter, but expand within a week or it'll be useless in a year.
