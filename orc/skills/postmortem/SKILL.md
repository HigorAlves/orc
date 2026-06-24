---
name: postmortem
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

```markdown
# Postmortem — <one-line summary> — YYYY-MM-DD

- **Severity:** SEV-1 | SEV-2 | SEV-3 (project-defined)
- **Status:** Draft | In review | Final | Action items in flight
- **Incident start:** YYYY-MM-DD HH:MM TZ
- **Incident end:** YYYY-MM-DD HH:MM TZ
- **Duration:** Xh Ym
- **Customer impact:** <numeric where possible — N users, $X revenue, P0 features affected>
- **Contributors to this document:** <names — for credit, not blame>

## Summary

Two-to-three sentences. What happened, what was the impact, what fixed it. Should be readable by an exec who didn't see the incident.

## Timeline

Chronological, in the user's local timezone or UTC (be explicit). Include detection, response, mitigation, resolution.

| Time | Event | Source |
|------|-------|--------|
| 14:02 | First customer complaint | Support inbox |
| 14:07 | Pager fires (latency p99 > SLO) | Datadog |
| 14:09 | On-call ack'd, started investigation | PagerDuty |
| 14:18 | Identified spike correlated with deploy 14:01 | Runbook check |
| 14:24 | Deploy rolled back | `kubectl rollout undo` |
| 14:28 | Latency back to baseline | Datadog |
| 14:31 | Customers notified of resolution | Status page |

Be precise on times. Cite the source of each entry (logs, dashboard, chat transcript) so future readers can re-verify.

## What happened (mechanism)

The technical chain of events. *What* changed, *what* it caused, *why* the safety nets didn't catch it. 1–3 paragraphs. Quote real code/config diffs and dashboard screenshots if helpful.

## Root cause(s)

Often there's more than one. List each.

- **RC1 (technical):** <the specific bug, config drift, capacity gap>
- **RC2 (system):** <what allowed RC1 to reach production — gap in tests, gap in review, missing alert>
- **RC3 (organizational, if applicable):** <process / on-call / training factor>

For each, do a brief "why?" chain (3–5 deep). Stop when "fix this" becomes a credible action item, not when "an engineer made a mistake."

## Contributing factors

Things that made the incident worse but weren't root causes. (Slow rollback because of stale runbook? Alert was noisy so it was muted? Backup failed silently last week?)

## What went well

Genuinely. Find at least three. ("On-call responded in under 5 min." "Rollback procedure worked first try." "Customer comms went out within 30 min.") Validates the things you don't want to lose.

## What went poorly

Honest. ("Alert fired on a metric that was a lagging indicator." "Runbook step 3 referenced a tool that no longer exists." "We assumed a feature flag was off; it wasn't.")

## Action items

Each action item gets:

- **Owner:** <role or name>
- **Severity:** P0 (must do this week) / P1 (this month) / P2 (this quarter)
- **Tracking:** <issue / PR link>
- **Done when:** <observable outcome>

Format as a checklist:

- [ ] **P0** Owner: <role> — Add alert on <metric> tied to <SLO> — tracked in <link> — done when alert fires in next staging incident drill
- [ ] **P1** Owner: <role> — Update runbook step 3 to reference <new tool> — tracked in <link>
- [ ] **P2** Owner: <role> — Add capacity headroom on <service> — tracked in <link>

Avoid action items shaped like "be more careful" or "communicate better." Those are not actions; they're vibes.

## Lessons & changes to mental model

What did we learn that future-us should know?

- "We thought X was true; turns out it isn't, because Y."
- "The system has more coupling between A and B than we'd documented."

These often spawn ADRs or doc updates downstream.
```

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
