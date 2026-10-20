<!-- orc:incident/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Assess, then the strategy gate

Answer the blast radius with evidence, not vibes.

1. Record who is affected: `userCount` and `count` from Sentry when available.
2. Without Sentry, record the user's best estimate, marked `(unverified)`.
3. Record since when: `firstSeen`, and whether the start correlates with a deploy.
4. Run `git log --oneline --since=<firstSeen>` on the deployed branch; note the Sentry `release` tag.
5. Record the scope: endpoints, regions or tenants, and the error-rate trend from `lastSeen`.
6. If `--severity` is absent, propose a tier from the ladder below.
7. Confirm the tier via `AskUserQuestion`.
8. Append the assessment to the timeline and `evidence.md`.
9. Bump the checkpoint to phase=2; record the severity in `.orc/orc.json`.
10. Print the gate callout below with a recommendation.
11. Ask via `AskUserQuestion` with the three options below; route per the option.

Severity ladder (same as `/orc:postmortem`):

- SEV-1: total outage, data loss, or a security event.
- SEV-2: significant degradation or a partial outage.
- SEV-3: edge-case impact or a near-miss.

Scope questions: one endpoint or everything; one region or tenant or all; error rate trending up, flat, or down.

Gate callout (per `orc:callouts`):

```markdown
> **⛔ Gate — mitigate first, or root-cause first?**
>
> <SEV tier> — <N> users, ongoing since <time>. Recommendation: <mitigate-first when user impact is ongoing and a rollback/flag path exists; root-cause-first when impact is contained, already mitigated, or no safe mitigation exists>.
```

`AskUserQuestion` options:

- "Mitigate first — stop the bleeding, investigate after" → Read `orc:incident/P3`.
- "Root-cause first — impact is contained, find the cause now" → Read `orc:incident/P4`.
- "Both in parallel — I'll mitigate manually while orc investigates" → Read `orc:incident/P4`; append the user's manual mitigation steps to the timeline as they report them.
