# 09 — Writing an RFC

## Scenario

The team is debating: *"Should we build feature flags in-house or adopt LaunchDarkly?"* You've gut-feels in both directions, the cost difference is real, and a wrong choice locks you in for years. This needs a written design before any code.

That's RFC-shaped.

## Flow

```
/orc:rfc "feature flag system: in-house vs LaunchDarkly" --grill
       │
       ├─→ Gate (warranted? — multi-week, technology lock-in, genuine uncertainty)
       ├─→ Init workspace (.orc/<branch>/files/rfc-NNNN.md)
       ├─→ Goals + Non-goals first (bounds everything else)
       ├─→ Background, Proposed design, Alternatives, Risks, Success criteria
       ├─→ orc:grill-me stress-test
       ├─→ Set decision deadline (default 1 week)
       └─→ Commit to docs/rfcs/, optionally open a discussion thread
```

## Walk-through

### Phase 1 — Gate

`/orc:rfc` runs the warranted-test:

- **Multi-team / multi-service?** Yes — every feature behind a flag touches multiple components.
- **≥ 2 weeks of effort?** Yes — building in-house is ~6 weeks; even adopting LaunchDarkly is 1-2 weeks of integration work.
- **Locks in technology?** Yes — vendor relationship + data model.
- **Genuine uncertainty between alternatives?** Yes.

All true → proceed. (If none were true, it'd suggest `/orc:plan` or `/orc:adr` instead.)

### Phase 2 — Init

```
.orc/feat-rfc-feature-flags/files/
├── checkpoint.md              # phase=2, command=rfc
├── rfc-0008.md                # workspace draft
└── orc.json
```

Sequence number `0008` because `docs/rfcs/0007-in-app-notifications.md` was the last one.

### Phase 3 — Goals + Non-goals first

`AskUserQuestion` walks you through:

```
What MUST this proposal accomplish?
- Targeting: enable/disable a flag for a single user, a percentage of users, or a custom segment.
- Real-time: changes propagate to running instances within 30s.
- Audit: who changed what when, persisted for ≥1 year.
- Self-serve: PMs and ops can change flags without engineering involvement.

What is explicitly OUT of scope?
- A/B test analytics (different system).
- Permission management beyond "who can change flags."
- Mobile-app local caching of flags (separate decision).
```

These bound everything that follows — the alternatives section will be evaluated against these goals.

### Phase 4 — Remaining sections

`/orc:rfc` drafts:

```
## Background / Context
We have ~12 hardcoded `if (USE_NEW_X)` constants in the codebase, with
no centralized control. Last quarter, three production rollbacks could
have been avoided with a kill switch. Engineering team: 8 people; current
flag changes require a deploy.

## Proposed design

### Option 1 — Build in-house
- Postgres-backed flag service + sidecar evaluator + admin UI
- ~6 weeks of engineering effort
- Ongoing ownership cost: ~5% of one engineer's time

### Option 2 — LaunchDarkly
- Adopt the SDK in our 4 services
- ~1-2 weeks of integration effort
- $/year cost for a team our size: $X (current pricing)
- Less control over data residency

### Hybrid — Adopt LD now, plan in-house if we hit a constraint
- 1-2 weeks now, optionality later
- Extra integration work if/when we migrate

## Alternatives considered

### Status quo (hardcoded constants)
- Why rejected: doesn't solve the problem.

### Alternative vendors (Statsig, Split.io, Optimizely)
- Brief evaluation: each compared on price, data residency, SDK quality.
- Why rejected: LaunchDarkly's free tier covers our short-term load,
  pricing scales predictably, and SDK coverage matches our stack.

## Open questions
- Q1: Do compliance / data-residency requirements rule out a US-hosted
  vendor? (Preferred answer: no, but I want legal team confirmation.)
- Q2: If we adopt LaunchDarkly, which evaluation latency budget do we
  set? (Preferred answer: <5ms p99 in-process via local cache.)

## Risks & unknowns
- Vendor lock-in if we later need features LaunchDarkly doesn't have.
- Going in-house: we underestimate the maintenance cost (calibration:
  +50% of initial estimate is typical for this kind of platform work).

## Success criteria (3 months in)
- ≥ 80% of new feature merges include a flag from day 1.
- 0 deploys to revert features (vs current 1-2/month).
- Median flag-change-to-effect latency: < 30 seconds.
```

### Phase 5 — Grill

```
Skill: orc:grill-me
```

The skill interviews you against the draft. Likely questions:

- "Open Q1 (data residency) is the kind of question that flips the recommendation — why is it not a hard gate?"
- "Why is build-in-house's ongoing cost only 5%? What if we hit a feature gap and need to extend?"
- "Success criteria #1 is a behavior change — is that an org-change problem, not a tooling problem?"

You answer; the RFC document gets revised. `checkpoint.md` bumps.

### Phase 6 — Decision deadline

Default: today + 7 days. `AskUserQuestion` to override.

### Phase 7 — Commit

`AskUserQuestion`:

- "Commit to `docs/rfcs/0008-feature-flag-system.md` and open a GitHub Discussion / PR thread"
- "Commit only — no thread yet"
- "Save as draft only — keep in `.orc/` for now"

You commit + open a discussion thread.

```
docs(rfc): 0008 — feature flag system: in-house vs LaunchDarkly
```

### Phase 8 — Decision

By the deadline (1 week later), the team converges. Two outcomes:

**A. Approved** — mark RFC `Status: Approved`. The RFC's locked-in choices spawn:

- An ADR for each durable decision (e.g. ADR-0009 "use LaunchDarkly as feature-flag platform").
- A `/orc:plan --issues` to decompose implementation into vertical slices.

**B. Rejected** — mark `Status: Rejected`. Leave the document; it's documentation that we considered and rejected this approach, with the analysis. A future RFC that revisits the question can cite this one.

Both A and B are successful RFC outcomes. The waste case is an RFC that drifts past its deadline without resolution.

## Artifacts

```
docs/rfcs/0008-feature-flag-system.md           # the published RFC
.orc/feat-rfc-feature-flags/files/
├── checkpoint.md                                # phase: done
├── rfc-0008.md                                  # workspace draft
├── progress.md
└── (post-grill answers folded back into the doc)
```

If approved, downstream:

```
docs/adr/0009-use-launchdarkly-for-feature-flags.md
GitHub issues #501-#510 (one per implementation slice)
```

## Done when

- The doc is committed.
- A decision deadline is set.
- Goals/Non-goals are explicit.
- Each alternative has a real "why rejected" reason.
- Success criteria are measurable.
- Status is `Draft` → `In Review` → `Approved` or `Rejected` (never stays in Review past the deadline + 1 extension).

## RFC vs ADR vs Plan — when to reach for which

| Document | Question it answers | Lives until |
|----------|--------------------|-------------|
| **RFC** | "Should we build X this way?" — exploratory | Decision is made; status moves to Approved/Rejected |
| **ADR** | "We decided X; here's why." — durable | Superseded by another ADR or project ends |
| **Plan** | "Now that we're building X, in what order?" | Work is shipped |

An approved RFC typically spawns 1-N ADRs (one per durable decision) and 1 plan (work breakdown).

## Variants

- **`--review <path>`** — review an EXISTING RFC instead of authoring. The agent walks the doc with critique focused on missing alternatives, undefined success criteria, hidden assumptions. Returns a finding list (one line per finding) using `orc:caveman-review` discipline. You don't get to rewrite the RFC — that's the author's job.
- **Solo RFC (no team to review)** — still useful as a written record of why you picked X. Skip the discussion thread, mark `Status: Approved` after self-review.
- **Rejected RFC after a week of debate** — perfectly fine. Mark Rejected, leave the doc, next RFC that revisits the question links to this one for the analysis.

## Iron rules in play

- **#6 — multi-phase work writes to `.orc/`.** RFCs are inherently multi-phase (Goals first, then design, then grill).
- **No code without a failing test** — doesn't apply during the RFC phase. RFCs are pre-code. The plan that comes from an approved RFC is what triggers TDD.
- **Decision deadline isn't optional.** Without one, RFCs die in committee.
