# Postmortem template

Disclosed from `orc:postmortem-writing`. Read at step 4 (draft with the template).

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
