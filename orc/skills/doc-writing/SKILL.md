---
name: doc-writing
description: "Shared scaffolding for numbered design/spec docs — outline, NNNN-* numbering, review gates, doc-type map (PRD/TRD/RFC/ADR/postmortem). Referenced by orc:prd/trd/rfc/adr-writing + postmortem."
---

# Doc Writing — shared scaffolding

This skill holds the material common to every numbered design/spec document orc authors. The five type-specific skills — `orc:prd-writing`, `orc:trd-writing`, `orc:rfc-writing`, `orc:adr-writing`, `orc:postmortem-writing` — defer here for the shared parts and add only their own template, fields, and tone.

Read this first when authoring any of those docs. It answers: **which doc type is this?**, **how is it laid out?**, **where does it get published?**, and **what are the review gates?**

## The doc-type map — which one is this?

Six types — PRD, TRD, RFC, ADR, postmortem, plan — form a lineage: **PRD → TRD → (RFC if alternatives exist) → plan → ADRs as decisions lock in**; a postmortem is off to the side. Read [DOC-TYPE-MAP.md](references/DOC-TYPE-MAP.md) when the type is in doubt: the matrix (question, audience, lifetime) and how each pair differs. When the choice is borderline, surface the call to the user rather than guessing.

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

Header / metadata → Summary → Goals → Non-goals → Background → Body (type-specific) → Risks & open questions → Success criteria → Appendix. Read [SECTION-OUTLINE.md](references/SECTION-OUTLINE.md) for what each section carries. Fill every section with real content. **Delete a section that genuinely has no content — never leave `TBD` or a stub placeholder.**

## Review gates

Discipline shared across all five types:

1. **Confirm the doc type is warranted** before drafting — apply the "when to write one" test in the type's skill. If borderline, surface the call (this type / a smaller artifact / nothing).
2. **Draft alone first.** A blank doc reviewed by five people becomes design-by-committee; an opinionated draft sharpens the conversation.
3. **Bound it before filling it.** Write Goals and Non-goals first — they constrain everything below.
4. **Show the draft to the user before committing.** Use `AskUserQuestion` with options like "Looks good — commit" / "Edit before commit" / "Save as Draft (status flag flipped)".
5. **Revise the document, not the comments.** When a reviewer's feedback changes the doc, edit the doc and resolve the comment. The final doc reads as if the discussion never happened.
6. **Move the Status.** A doc stuck in `Draft` / `Proposed` forever is a smell — either advance it (In Review → Approved/Accepted) or archive it. Don't let docs rot in their initial status.
7. **Commit** via `orc:git-commit`. Suggested message shape: `docs(<type>): NNNN — <kebab title>`.
8. **Cross-link after acceptance** — from tickets, related docs, and any code the doc governs.

## Shared tone

Engineer-to-engineer (or product-minded-engineer-to-product-and-engineering for PRDs), plain prose. Bullets and tables where they add precision; diagrams where 200 words of prose would otherwise be needed. **No marketing voice** ("delight", "seamless", "best-in-class"). **No "obvious" or "trivial"** — if it were obvious, you wouldn't be writing the doc. Cite constraints by name (latency budget, deadline date, vendor SLA, named stakeholders by role). When a driver is non-technical (legal, vendor relationship, exec mandate), say so plainly — the future reader needs that context. Be honest about negatives and unknowns; a doc with no downsides is a sales pitch, not a record.
