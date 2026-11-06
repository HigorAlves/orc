# Examples

Three PR descriptions shaped by the Rules in [SKILL.md](../SKILL.md): a title-only bug fix, a feature with a Why and QA link, and a refactor with a breaking change and a merge-danger line.

## Bug fix — title is self-explanatory, no Why section

```
fix(billing): guard against zero-cap users in usage display

## How tested
Tests: 142 pass. Manual: opened /billing as a free-tier user with cap=0,
output now reads "$0 of $0" (was "$NaN of $undefined").

Closes #482
```

## Feature — Why required, links plan + QA

```
feat(reports): add CSV export

## Why
Customer-requested in support tickets #311, #389, #412. Plan at
.orc/feat-csv-export/files/plan.md.

## How tested
Tests: 47 pass. Browser QA: .orc/feat-csv-export/files/qa/steps.md
(golden path, empty report, 1k-row report, permission-denied).

Closes #311
```

## Refactor with breaking change + risk

```
refactor(auth): replace JWT validation with opaque session lookup

## Why
ADR-0007 — compliance flagged JWT non-revocability after incident #142.

## What changed
- Authenticated middleware now hits Redis on every request instead of
  parsing the JWT in-process.
- Old JWT path remains for 30 days, flag-gated by USE_OPAQUE_SESSIONS.

## How tested
Tests: 312 pass. Staging load test: p99 latency +3ms (within budget).

## Notes
- Door: one-way once the 30-day window closes · Blast radius: every authenticated request.
- Hard dependency on session service availability — outage = no auth.
  Runbook update in #318.
- Breaking change at end of 30-day window; tracked via #319.

Closes ENG-712
```
