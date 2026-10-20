# PRD template

The shape every PRD takes. Read this from step 4 of [SKILL.md](../SKILL.md) when drafting; the rules on empty sections and `TBD` live there.

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
