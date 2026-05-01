# 08 — Writing an ADR

## Scenario

The team just decided: *"We're switching from JWT-based session tokens to opaque session IDs stored server-side."* The conversation happened in a meeting. There's a vague Slack summary. In six months, a new hire will ask "why opaque sessions?" and nobody will remember.

That's an ADR-shaped gap.

## Flow

```
/orc:adr "use opaque server-side session IDs"
       │
       ├─→ Apply the ADR test (architectural? non-obvious? durable?)
       ├─→ Find next NNNN in docs/adr/
       ├─→ Draft via orc:adr-writing skill
       ├─→ Show draft, get approval
       └─→ Commit (docs(adr): NNNN — title)
```

## Walk-through

### Phase 1 — Confirm an ADR is warranted

`/orc:adr` invokes `orc:adr-writing` and runs the gate:

- **Architectural?** Yes — touches every authenticated endpoint, the session-storage layer, and clients that read tokens.
- **Non-obvious?** Yes — JWT was the previous choice for a reason; another smart engineer might prefer JWT.
- **Durable?** Yes — auth scheme changes are quarterly events at most.

All three true → proceed.

### Phase 2 — Find next sequence

```bash
ls docs/adr 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1
# 0006-cross-service-event-bus.md
```

Next number: `0007`.

### Phase 3 — Draft

`/orc:adr` creates `docs/adr/0007-use-opaque-server-side-session-ids.md` using the `orc:adr-writing` template:

```markdown
# 0007 — Use opaque server-side session IDs

- **Status:** Accepted
- **Date:** 2026-05-01
- **Deciders:** Higor (engineering), security review (J.S.)

## Context

We've been issuing JWTs (HS256, 24h expiry) since the original auth design.
Recent compliance review flagged that JWT revocation requires a deny-list,
which we don't maintain. A user who rotates their password retains a valid
JWT until expiry — observed in incident #142 (2026-04-12) where a
compromised account remained accessible for 18 hours after password reset.
Session storage cost is no longer a constraint (we have Redis with capacity
budget for 100× current sessions).

## Decision

Issue opaque 32-byte random session IDs, stored in Redis (TTL: 14 days
sliding window). Look up on every authenticated request via a session
service. Old JWTs continue to validate during a 30-day migration window;
afterward, JWT validation is removed.

## Alternatives considered

### Option A — Keep JWT, add a deny-list service
Build a Redis-backed deny-list, check on every request.
- Why rejected: requires a lookup on every request anyway (negating JWT's
  stateless benefit), plus we need to maintain TWO auth flows during
  rollout.

### Option B — Short-lived JWT (15-min expiry) + refresh token
Industry-standard pattern.
- Why rejected: 15-minute incident window is still a compliance flag, and
  refresh-token storage gives us the same lookup-cost as opaque sessions
  without the simpler revocation story.

### Option C — Do nothing
- Why rejected: compliance review will not approve the next audit without
  revocation capability.

## Consequences

- **Positive:** Instant revocation on logout / password change. Single
  source of truth for session state. Compliance audit unblocked.
- **Negative:** Every authenticated request now has a Redis lookup
  (~1ms p50, +3ms p99 in current load tests). Session service becomes a
  hard dependency — outage = nobody can authenticate.
- **Neutral:** Client SDKs need to update token-refresh logic during the
  30-day overlap window.

## Follow-ups

- [ ] Build session service — tracked in #312
- [ ] Update all client SDKs to use new endpoint — tracked in #313
- [ ] Add session-service availability to status page — tracked in #314
- [ ] After 30 days: remove JWT validation path — tracked in #315
```

### Phase 4 — Review

`AskUserQuestion`:

- "Looks good — commit"
- "Edit before commit" (loop back)
- "Save as draft (Status: Proposed)"

You pick "Looks good — commit."

### Phase 5 — Commit

```
docs(adr): 0007 — use opaque server-side session IDs
```

The command then surfaces a hint: *"Link this ADR from any code or doc that depends on the decision — the link should be the entry point, not the reverse."*

You add a comment to `src/auth/session.ts:1` linking to the ADR, and reference it in the auth-system explanation doc.

## Variants

### Superseding an existing ADR

A year later, you decide to switch from Redis to DynamoDB for session storage. That doesn't replace ADR-0007 — but it amends part of it. Two valid moves:

1. **Amend in-place** — edit ADR-0007's `Decision` and `Consequences` sections, bump the date. Note in the commit that the change is non-load-bearing.
2. **Supersede with a new ADR** — write ADR-0024 ("session storage on DynamoDB"), `--supersede 0007`. The new ADR's Context cites 0007 and explains why the situation changed.

`/orc:adr "session storage on DynamoDB" --supersede 0007` does the supersede flow:
1. Marks 0007 as `Superseded by 0024`.
2. Drafts 0024 with Context referencing 0007.

### Status: Proposed

If you're not sure the team will accept the decision, draft as `Status: Proposed` and circulate. Set yourself a reminder in the AskUserQuestion follow-up (1 week / 1 month / never). ADRs in `Proposed` that never move to `Accepted` are rot.

## Artifacts

```
docs/adr/0007-use-opaque-server-side-session-ids.md
```

That's it. ADRs don't write to `.orc/` — they're durable by design.

## Done when

- The ADR file exists at `docs/adr/NNNN-<kebab-title>.md`.
- It's `Status: Accepted` (or `Proposed` with a follow-up reminder).
- Every section has real content (no `TBD`).
- At least one negative consequence is honestly listed.
- Code/docs that depend on the decision link to the ADR.
- The follow-up tasks are filed as tracker issues (or the ADR explicitly notes "no follow-ups needed").

## What NOT to do

- Don't write ADRs for library version bumps with no API impact.
- Don't write ADRs with no `Alternatives considered` — that means the decision wasn't really made.
- Don't write ADRs months after implementation — hindsight filters out the negatives.
- Don't reuse a sequence number, even for superseded ADRs.

## Iron rules in play

- **No AI attribution.** ADRs are engineering records. They read as if a senior engineer wrote them.
- **Insight blocks aren't ADR content.** Save `★ Insight ─────` for conversations.
