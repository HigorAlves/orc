---
name: trd-writing
description: Author Technical Requirements Documents (TRDs) — the technical contract that translates a settled PRD into interfaces, data shapes, failure modes, and constraints, before RFC debate or implementation plans. Use when the user says "write a TRD" / "spec the technical contract" / "we have the PRD, now what are the interfaces", when /orc:trd is invoked, or when a PRD's "How" needs to be pinned down before plan or RFC. Distinct from rfc-writing (which debates alternatives) and adr-writing (which records a single decision).
---
# TRD Writing

A TRD turns "what & why" into "what we will build, technically." It pins down interfaces, data, failure modes, and constraints — the things engineering will commit to producing — *before* the design debate (RFC) or the implementation breakdown (plan).

A good TRD lets a reviewer say "yes, this contract solves the PRD" without having to read code, and lets the next person to write the RFC or plan start from a stable surface area.

## When to write one

Write a TRD when **all** of these are true:

- A **PRD (or equivalent product spec) has settled the "what & why"** — you're not still arguing about audience or scope.
- The work introduces **non-trivial technical surface area** — new APIs, new data model, new failure modes, new dependencies, or contracts other systems must conform to.
- Multiple engineers / services / repos will need to agree on the contract before parallel work can start.

Don't write a TRD for:

- Single-file changes inside one module → the plan is enough.
- Pure debate of alternatives ("pgbouncer vs. pgcat") → that's an `orc:rfc-writing` job.
- Locking in a single architectural decision after debate → that's `orc:adr-writing`.
- Anything where the PRD itself is unsettled → write/finish the PRD first (`orc:prd-writing`).

## TRD vs PRD vs RFC vs ADR vs plan

| Document | Primary question it answers | Stable when |
|----------|----------------------------|-------------|
| **PRD** | "What & why for the user?" | Product intent locked in |
| **TRD** | "What's the technical contract — interfaces, data, failure modes?" | Engineering team agrees on the contract |
| **RFC** | "How should we build it? Which alternative wins?" | Decision made (Approved or Rejected) |
| **ADR** | "We decided X; here's why." | Forever (until superseded) |
| **Plan** | "In what order do we ship the slices?" | Work shipped |

A typical lineage: PRD → TRD → (RFC if alternatives exist) → plan → ADRs as decisions lock in.

A TRD without a PRD is a TRD answering a question nobody asked. A TRD with no contract section is just an RFC mislabeled.

## Where they live

`docs/trds/NNNN-<kebab-name>.md`. Same numbering convention as ADRs/RFCs — four-digit zero-padded, monotonic across the project, never reused.

If `docs/trds/` doesn't exist, create it and add a one-line `docs/trds/README.md` pointing to this skill.

## Interview checklist (before drafting)

Skip questions whose answers are already in the linked PRD or in conversation. Don't make the user repeat themselves.

1. **What PRD or product context is this TRD serving?** (link)
2. **Goals.** What technical outcomes MUST this TRD's contract enable? Be specific.
3. **Non-goals.** What are we explicitly *not* committing to in this contract? (Heads off scope drift.)
4. **Public interfaces.** What APIs, schemas, events, CLI surfaces, or library entry points does this introduce or modify? Public = anything another component or repo depends on.
5. **Data model.** What persisted shapes change or get added? Migrations? Indexes? Backfill?
6. **Failure modes.** What can go wrong in this contract, and what's the contract's response (retry / dead-letter / surface to user / ignore)?
7. **Constraints.** Performance budgets, security/compliance, capacity, vendor lock-in, language/framework requirements.
8. **Dependencies.** Other services, libraries, teams whose work this requires or affects.
9. **Success criteria.** How will we verify the contract is met? (Tests, SLOs, integration checks.)
10. **Open questions.** Things the author needs reviewer input on.

## Template

Every TRD uses this shape. Delete sections with no real content rather than leaving `TBD`.

```markdown
# TRD NNNN — <Technical title in noun phrase>

- **Status:** Draft | In Review | Approved | Implemented | Superseded
- **Author:** <name>
- **Created:** YYYY-MM-DD
- **Last updated:** YYYY-MM-DD
- **Linked PRD(s):** <PRD-NNNN refs or external link>
- **Linked RFC(s)/ADR(s):** <NNNN refs, if any>
- **Linked tickets:** <Jira/Linear keys, if any>
- **Reviewers:** <names or roles>

## Summary

Two-to-three sentences. What technical contract this TRD pins down, and why now. A reader who reads only this paragraph should know whether the contract concerns them.

## Goals

What this TRD's contract MUST enable. Bulleted, specific, measurable where possible.

- ...
- ...

## Non-goals

What this TRD explicitly does NOT commit to. Anything in this list is fair game for a future TRD or RFC; nothing here is a promise.

- ...
- ...

## Background / context

What does the system look like today? What constraints (latency budget, scale, regulatory, team capacity) bound the contract design? Cite real numbers and link to relevant prior PRDs/RFCs/ADRs/dashboards.

## Public interfaces & contracts

The core of the document. Describe every contract this TRD introduces or changes, in terms callers can rely on.

### API shapes

Function signatures, HTTP routes, gRPC methods, event schemas, CLI surfaces — whatever the public edges are. Include request/response shapes with field types. Mark fields **required**, **optional**, **deprecated**.

### Data model

Schema diffs (added tables, added columns, added indexes), enum changes, persisted-event shape changes. Note **backfill**, **migration order**, **index strategy** if relevant.

### Events / messages (if applicable)

Topic name, payload shape, producer, consumer, ordering guarantees, idempotency expectations.

## Failure modes & error handling

For each contract above, what can go wrong and what's the contract's response?

| Failure | Detection | Response | User-visible? |
|---------|-----------|----------|---------------|
| <e.g. downstream timeout> | <how we know> | <retry / DLQ / surface> | <yes/no> |
| ... | ... | ... | ... |

Also list any **invariants** the contract must preserve (e.g. "every payment event has exactly one corresponding ledger entry").

## Constraints

- **Performance:** <latency p50/p95/p99 budgets, throughput targets, memory ceilings>
- **Security / compliance:** <PII handling, encryption-at-rest/in-transit, audit log requirements, regulatory scope>
- **Capacity:** <RPS, storage growth, connection limits>
- **Lock-in:** <any vendor or framework choice this contract assumes>

## Dependencies & integrations

Other services, libraries, vendors, or teams this contract depends on or affects. For each: name, owner, expected interaction (call / be called by / event / shared store), and risk of change.

## Migration / rollout (if behavior changes)

How do we get from current state to the new contract safely?

- Backwards-compatible window?
- Two-phase deploy?
- Feature flag?
- Data backfill order?
- Rollback plan?

## Success criteria

How do we verify the contract is met *and* still met later?

- **Tests:** unit / integration / contract / load — which ones must exist before "done."
- **SLOs:** error rate, latency p95, dependency health.
- **Acceptance:** the specific checks that make this TRD "Implemented."

## Open questions

- Q1: <preferred answer if any>
- Q2: ...

## Risks & unknowns

What could go wrong that the contract doesn't address? What evidence would change the recommendation?

## Appendix (optional)

- Benchmark results
- Prior-art links
- Example payloads
- Glossary
```

## What to do as the model

1. **Confirm a TRD is warranted** — apply the "all of these are true" test. If borderline, surface (TRD / single design note in code / an RFC instead).
2. **Locate or read the linked PRD.** A TRD without a PRD reference (or equivalent product context) is suspect — surface that and ask.
3. **Run the interview** if input is sparse. Skip questions answered by the linked PRD or earlier in conversation.
4. **Find the next sequence number** — `ls docs/trds 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1` and increment. Pad to four digits.
5. **Draft from the template.** Fill every section. **Delete sections that have no content** rather than writing `TBD`. The "Public interfaces & contracts" section is the load-bearing one — if it's thin, the TRD isn't ready.
6. **Show the draft to the user for review** before committing. `AskUserQuestion`: "Looks good — commit" / "Edit before commit" / "Save as Draft".
7. **Commit** via `orc:git-commit`. Suggested message: `docs(trd): NNNN — <kebab title>`.
8. **Cross-link.** From the linked PRD, from any tickets, from any code that will conform to the contract.

## Tone

Engineer-to-engineer, plain prose, schemas and tables where they add precision. No marketing voice, no "obvious" or "trivial." Quote constraints by name (latency budget, deadline, vendor SLA). When a constraint is non-technical (legal, vendor relationship, exec mandate), say so plainly — the future reader needs that context.

## Anti-patterns

- **TRDs written after implementation.** The contract gets reverse-engineered from the code; the failure-mode section gets sanitized; the unknowns section disappears. Write the TRD *before* the plan.
- **TRDs that debate alternatives.** That's an RFC. A TRD commits to *one* contract; argument belongs upstream.
- **Empty "Failure modes" section.** Every contract has failure modes. If you can't think of any, you haven't thought hard enough.
- **TRDs without measurable success criteria.** "We'll know when it works" means nothing is testable.
- **Mismatched scope vs. PRD.** A TRD wider than its PRD is scope creep; narrower means part of the PRD has no technical contract yet.
- **TRDs with no `Non-goals`.** Without explicit exclusions, the contract grows in review until nothing ships.
