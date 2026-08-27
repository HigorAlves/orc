---
name: scale-tracks
description: Mechanical scope-to-phase routing for orc's lifecycle — the quick/standard/deep track table, activation criteria, and the escalate/de-escalate rules. Use when triaging work in /orc:flow or /orc:plan, or when a plan turns out bigger or smaller than the track it was started on.
---

# Scale Tracks

A bug fix and a platform migration do not deserve the same process. Asking "how big is this?" and then running identical phases regardless is how a two-hour change acquires an RFC — and how a two-week one ships without a plan.

The scope answer resolves to a **track**, and the track mechanically decides which phases run. One recorded decision, not a vibe.

## The three tracks

| | `quick` | `standard` | `deep` |
|---|---|---|---|
| **Shape** | Clear scope, one head can hold it | Needs a plan; conventions could drift | Genuine alternatives, or blast radius across teams |
| **Planning artifact** | `tech-spec.md` | `plan.md` + slice ledger | RFC → `plan.md` + slice ledger |
| **Flow phases** | 1 → 4 → 5 → 6 → 7 (→ 8, 9) | 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 | all 9, Phase 2 RFC mandatory |
| **Slice ceiling** | 3 | 12 | none — expect `ships_as_stack` |
| **Grill** | no | `--grill` optional | mandatory |
| **Readiness gate** | advisory | blocking | blocking |
| **Planning budget** | minutes | under an hour | hours to days |

`quick` does not skip rigour — the failing test, the QA evidence packet, the size budget, and every iron rule still apply. It skips **planning ceremony**, nothing else.

## Choosing the track

Resolve in this order; first match wins.

1. **`--track=` flag** → use it. Record with provenance `flag`.
2. **Settled decision** (`orc-state decision get track`) → use it, echo the settled-decision line.
3. **Ask** — the scope question in `/orc:flow` Phase 1 maps directly:

| Scope answer | Track |
|---|---|
| < 1 day | `quick` |
| 1–5 days | `standard` |
| 1–4 weeks | `deep` |
| multi-quarter | neither — route to `/orc:wayfinder` |

### Overrides that beat the scope answer

Any one of these forces at least `standard`, regardless of how small it felt:

- the change introduces an architectural decision (the `orc:adr-writing` three-part gate would fire);
- it spans more than one repo in workspace mode;
- it changes a public contract — API shape, wire format, DB schema, exported package surface;
- it touches auth, payments, or PII handling.

Say which override fired when you apply one. A silent upgrade reads as the command ignoring the answer.

## The `quick` track

Phases 2 and 3 collapse into a single artifact: `.orc/<branch>/files/tech-spec.md`.

```markdown
# Tech spec — <one-line deliverable>

## Change
What is being changed, in three sentences.

## Approach
The chosen approach, and the one alternative considered if there was one.

## Slices
1–3 slices, each with the full `orc:writing-plans` header — `est_loc`, `touchpoints`,
`acceptance` (2–5 testable criteria), `depends_on`. The ledger is generated from
these exactly as it is from a full plan.

## Verification
How this is proven green: the failing test, and the QA surface if any.
```

The slice ledger is installed from a tech-spec identically to a plan (`orc-state slice init`) — downstream phases cannot tell the difference, and must not need to. `planSha256` hashes `tech-spec.md` instead of `plan.md`.

## Escalation

Escalation is not failure — it is the track doing its job. Check at the end of the planning phase:

| Trigger | Action |
|---|---|
| `quick` plan yields > 3 slices | offer → `standard` |
| An override from the list above fires mid-planning | offer → `standard` (or `deep` if alternatives are genuinely open) |
| `standard` plan yields > 12 slices, or the design has real alternatives | offer → `deep` |

**Prior work is input, never waste.** An escalating `tech-spec.md` becomes the seed for `plan.md` — its Change section is the problem statement, its Slices are the first draft. Say so when offering:

> **⛔ Gate — track escalation**
>
> quick track, but the plan came out at 6 slices (ceiling 3). tech-spec.md carries forward as the plan seed.

Options: escalate / stay on the track and split the work / abort.

## De-escalation

The same check, downward — a `standard` plan that lands at ≤3 slices with no architectural decision and no override is a `quick` job that cost an hour of planning. Offer the collapse **once**, at the plan gate, then drop it. Repeatedly second-guessing a settled track is worse than one track too heavy.

## Recording

The resolved track is a settled decision, write-once per session:

```
orc-state decision set track <quick|standard|deep> --provenance <flag|asked|inferred>
```

Escalation is the one exception to write-once — it rewrites `track` with provenance `asked` and appends a course-change record per `/orc:correct-course`. Nothing else may rewrite it.

## Consumer protocol

`/orc:flow`, `/orc:plan`, and `orc:writing-plans` read the track and change behaviour:

- **`/orc:flow`** — skips phases per the table. A skipped phase is announced in one line, never silently dropped, and `--total-phases` at `orc-state init` reflects the track.
- **`orc:writing-plans`** — reads the slice ceiling for granularity: `quick` favours one fat slice over three thin ones; `deep` favours splitting past the LOC budget with `ships_as_stack: true`.
- **The readiness gate** (`orc-state slice verify`) — blocking on `standard`/`deep`, advisory on `quick`.
