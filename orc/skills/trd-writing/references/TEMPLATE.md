# TRD template

Disclosed from `orc:trd-writing`. Read at step 5 (draft from the template).

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
