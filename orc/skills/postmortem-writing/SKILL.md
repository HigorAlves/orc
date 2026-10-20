---
name: postmortem-writing
description: Author blameless incident postmortems — timeline, root cause(s), contributing factors, action items. Use after a production incident (outage, data loss, security event, regression) or a near-miss.
---

# Postmortem

> **Defer to `orc:doc-writing`** for the shared scaffolding: the doc-type map (postmortem vs PRD/TRD/RFC/ADR, and how it differs from `systematic-debugging`), the shared section outline, the publication & numbering convention, and the review gates. This skill carries only the postmortem-specific template, blameless rules, and tone. Note: postmortems are date-keyed, not monotonically numbered (see the publication note in `orc:doc-writing`).

A postmortem is the artifact that turns an incident into organizational learning. The fix lands in code; the postmortem lands in the team's collective memory.

## When to write one

Write one for:

- Any **customer-visible** incident (degraded service, errors, data loss, security event).
- Any incident that triggered an **on-call page**, regardless of customer impact.
- **Near-misses** caught before customer impact but caused by a real defect (a manual override, last-minute deploy revert, etc.).
- **Recurring incidents** of the same kind — even if individually minor, the recurrence itself is the incident.

Don't write a full postmortem for:
- Bugs caught in QA or by a pre-deploy CI signal
- Performance regressions that were rolled back within the same deploy window with no production impact
- Single-engineer "oops" caught by a teammate's review — the review was the safety net working

## Blameless framing (non-negotiable)

A postmortem is **blameless**: it documents what *the system* (people + tools + processes) allowed to happen, not what an individual did wrong. This rule has three concrete consequences:

1. **Use roles, not names** in the timeline and root-cause sections. "The deploying engineer" — not "Alice." Names are fine in the *Contributors* header (people who took action during/after) but not in causal language.
2. **Replace "human error" with the system question.** "The engineer ran the wrong command" → "The deploy tool accepts a one-letter flag that's easily confused with another." The action item is on the tool, not on the engineer.
3. **No hindsight bias.** What was knowable to the responder *at the moment*? "They should have noticed X" is bias unless X was actually visible on a dashboard they were looking at.

If you find yourself writing "should have", stop and reframe.

## Where they live

`docs/postmortems/YYYY-MM-DD-<short-slug>.md`. Good for engineering-team-only postmortems; mirror to a shared doc tool (Notion, Confluence, Google Doc) when leadership, support, or non-engineering stakeholders need read access. For orc projects, default to in-repo (see the publication note in `orc:doc-writing`).

## Template

Read [TEMPLATE.md](references/TEMPLATE.md) when drafting (step 4): header block (severity, status, start/end, duration, impact, contributors), Summary, Timeline table with sources, What happened, Root cause(s) with why-chains, Contributing factors, What went well / poorly, Action items checklist (owner, P0–P2, tracking, done-when), Lessons.

## Severity definitions (project-dependent)

If the project doesn't have these defined, propose a minimal three-tier scheme during the postmortem and note that the definitions need an ADR/policy doc:

- **SEV-1** — Total outage or material customer harm (data loss, security breach). Pages everyone.
- **SEV-2** — Partial outage or significant degradation. Pages the on-call.
- **SEV-3** — Edge-case impact, recoverable by user, or near-miss. Doesn't page; still gets a postmortem if it's a real defect.

## Process discipline

1. **Write within 48 hours.** Memory fades fast and so do the relevant chat/log transcripts.
2. **Draft alone, then circulate.** Same as RFC — opinionated draft sharpens the discussion.
3. **Action items are the deliverable.** A postmortem with a great narrative and no action items has failed. A postmortem with three concrete action items and a sloppy narrative is succeeding.
4. **Track action items in the same tracker as feature work.** They die in a separate "tech debt" board.
5. **Status: Final ≠ done.** Mark "Action items in flight" while items are open. Move to Final only when all P0 items are closed (or explicitly punted with rationale).

## What to do as the model

1. Confirm there was a real incident worth documenting. If borderline (caught in CI, no production impact), suggest a shorter "near-miss note" instead.
2. Establish severity with the user (or propose a tier and confirm).
3. Build the timeline first — go to the chat transcript / pager / logs and lift events with timestamps. Don't paraphrase from memory.
4. Draft with the template. Fill each section. Use roles not names in causal language.
5. Surface the draft for the user to fill in any organizational context the model can't see (who decided what, what tools were used).
6. After acceptance, file the action items as tracker issues — don't leave them in the document only.

## Anti-patterns to refuse

- A postmortem that names a single individual as the cause.
- "We were on a tight deadline" without action items on the deadline-setting process.
- Action items of the form "everyone be more careful."
- Postmortems written by the implicated engineer alone.
- Treating the postmortem as published when it's still missing the tracker links for action items.
