---
name: prd-writing
description: Author Product Requirements Documents (PRDs) from scratch — interview-driven, templated, published to docs/prds/NNNN-*.md. Use for "write a PRD for X", an unsettled new feature, or /orc:prd.
---

# PRD Writing

> **Defer to `orc:doc-writing`** for the shared scaffolding: the doc-type map (PRD vs TRD vs RFC vs ADR vs postmortem, and how PRD differs from `orc:to-prd`), the shared section outline, the `docs/<type>s/NNNN-*.md` numbering & publication convention, and the review gates. This skill carries only the PRD-specific template, fields, and tone.

A PRD is the contract between product intent and engineering execution. It captures **what we're building, for whom, and why now** — *before* anyone argues about architecture. A good PRD makes the design conversation that follows it 10× faster because half the questions are pre-answered.

## When to write one

Write a PRD when **all** of these are true:

- The work has a **user-facing outcome** — a behavior, capability, or experience changes for someone outside the team.
- The intent is **non-obvious** — there's a real product question (which audience, which metric, which scope), not just an implementation question.
- The work is **non-trivial** — multi-day effort, or coordination across product/design/engineering.

Don't write a PRD for:

- Pure refactors with no user-visible change → use `orc:rfc-writing` if architectural, or just a plan.
- Tactical bug fixes → just fix it.
- One-day features that have no audience question (e.g. "add `--verbose` flag for engineers") → a plan or issue is enough.
- A decision that's already made and documented elsewhere → `orc:adr-writing` to record it.

## Interview checklist (before drafting)

If the user hasn't already answered these in conversation, ask before drafting. Skip questions whose answers are already obvious from context — don't waste user time interviewing them on things they've already said.

1. **Problem.** What user pain or business need triggered this? Quote a real signal — a support thread, a churn metric, a customer ask, a competitive feature, a regulatory deadline.
2. **Audience.** Who specifically benefits? Single persona, multiple personas, internal team, all users? If "all users," push back — usually it's a subset.
3. **Success metric.** How will we know in 90 days that this worked? Pick one primary metric, optionally one or two secondaries. "It feels better" is not a metric.
4. **In scope.** The smallest version of this that delivers the outcome.
5. **Out of scope.** What we are explicitly NOT building (heads off scope creep in review).
6. **Open questions.** What does the author *not yet know* but needs to before implementation?
7. **Dependencies / risks.** External teams, vendors, data, regulatory blockers, prior work that has to land first.

## Template

Every PRD uses this shape. Delete sections that genuinely have no content; **never leave `TBD` or stub placeholder text.** A section that's empty is a lie about being thought through.

```markdown
# PRD NNNN — <Feature title in noun phrase>

- **Status:** Draft | In Review | Approved | Shipped | Archived
- **Author:** <name>
- **Created:** YYYY-MM-DD
- **Last updated:** YYYY-MM-DD
- **Stakeholders:** <PM, design, eng lead, others>
- **Linked tickets:** <Jira/Linear keys, if any>
- **Linked RFCs/ADRs:** <NNNN refs, if any>

## Problem

What user pain or business need does this address? Quote a real signal — support volume, churn cohort, lost-deal reason, customer ask. 1–3 paragraphs. If the problem isn't real to the reader by the end of this section, the PRD has already failed.

## Audience & jobs-to-be-done

Who specifically benefits, and what job are they trying to get done? Use a persona name if your team has them; otherwise describe the role and context. If multiple audiences, list each with the job they care about.

## Success metrics

How will we know in 90 days this worked?

- **Primary:** <one measurable metric with a target — e.g. "CSV export adoption ≥ 30% of weekly active reporting users by 2026-Q3">
- **Secondary (optional):** <one or two supporting metrics>
- **Counter-metric (optional):** <a metric that should NOT regress — e.g. "report page load p95 ≤ 1.2s">

## User stories / acceptance criteria

The minimum behavior set, framed as user-visible outcomes:

- As a <user>, I can <action>, so that <outcome>.
- As a <user>, I can <action>, so that <outcome>.
- ...

For each, include 1–3 acceptance bullets a tester (or QA agent) could check.

## In scope

Concrete capabilities this PRD commits to delivering. Bulleted, specific.

## Out of scope

Capabilities explicitly excluded — both to bound the work and to head off "but what about…" scope creep in review.

## Risks & open questions

Things that could derail the work or that the author needs answered before implementation:

- **Risk:** <what could go wrong, how likely, how bad>
- **Open question:** <what we don't know yet; preferred answer if any; who owns answering>

## Rollout & measurement

How does this get to users?

- **Rollout strategy:** <flag, percentage rollout, beta cohort, big-bang>
- **Instrumentation:** <events / metrics that need to exist BEFORE launch to measure success>
- **Kill criteria:** <what signal would cause us to roll back / pause>

## Appendix (optional)

- Mockups, prior art, competitor analysis, supporting research.
```

## What to do as the model

1. **Confirm a PRD is warranted** — apply the "all of these are true" test above. If borderline, surface the call to the user (PRD / smaller-issue / nothing).
2. **Run the interview** if input is sparse — go through the seven checklist questions, but skip any already answered in context. Batch into 2–3 `AskUserQuestion` calls; don't drip one at a time.
3. **Find the next sequence number** in `docs/prds/` (see the numbering convention in `orc:doc-writing`).
4. **Draft from the template.** Fill every section with real content. **Delete sections that genuinely have no content** (e.g. no counter-metric, no appendix) rather than writing `TBD`.
5. **Show the draft to the user for review** before committing (review gates in `orc:doc-writing`).
6. **Commit** via `orc:git-commit`. Suggested message: `docs(prd): NNNN — <kebab title>`.
7. **Cross-link.** If the PRD relates to existing tickets, RFCs, ADRs — link FROM those to the PRD (the link should be the entry point, not the reverse).

## Tone

Plain prose, written by a product-minded engineer for product-and-engineering readers. No marketing voice ("delight", "seamless", "best-in-class"). No "obviously" or "trivially" — if it were obvious, you wouldn't need a PRD. Cite real numbers when you can: support ticket counts, latency budgets, deadline dates, named stakeholders by role.

## Anti-patterns

- **Status: Draft** that never moves. Either get approval or archive — don't let a PRD rot in Draft.
- **PRDs without success metrics.** "We'll know it's good when we see it" is a sign the author didn't think hard enough.
- **PRDs written after the feature shipped.** The "Why" gets sanitized in hindsight; future-you can't tell what was real motivation vs. retrofitted justification.
- **PRDs that read like specs.** If half the content is API shapes and database tables, you're writing a TRD or RFC — promote it accordingly.
- **PRDs without "Out of scope".** Without explicit exclusions, every reviewer will paste in their pet feature and the work doubles.
- **One-line problem statements.** "Users want CSV export" is not a problem statement; it's a solution. The PRD should articulate *the problem CSV export solves*.
