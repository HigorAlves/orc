# orc — examples

Concrete walk-throughs for the workflows orc is built for. Each scenario shows the right command sequence, what gets written to `.orc/<branch>/files/`, and the iron rules that apply.

## When you have ...

| Scenario | Read |
|----------|------|
| A reproducible bug or failing test | [01 — Fixing a bug](./01-fixing-a-bug.md) |
| Just had a production incident | [02 — Writing an incident postmortem](./02-incident-postmortem.md) |
| A new feature to ship | [03 — Adding a new feature](./03-adding-a-new-feature.md) |
| A new package/service or doc gap | [04 — Writing documentation](./04-writing-documentation.md) |
| A PRD from PM | [05 — Handling a PRD](./05-handling-a-prd.md) |
| Someone else's open PR | [06 — Reviewing someone's PR](./06-reviewing-someones-pr.md) |
| Reviewer comments on your PR | [07 — Responding to PR feedback](./07-responding-to-pr-feedback.md) |
| A non-trivial architectural decision | [08 — Writing an ADR](./08-writing-an-adr.md) |
| A multi-week design decision needing critique | [09 — Writing an RFC](./09-writing-an-rfc.md) |
| A web change ready to ship | [10 — Web QA before shipping](./10-web-qa-before-shipping.md) |

## How these examples are written

Every example follows the same shape so you can scan them quickly:

1. **Scenario** — what just happened, what you're trying to do.
2. **Flow** — the right sequence of orc commands, named.
3. **Walk-through** — what each phase does, what to expect.
4. **Artifacts** — what gets written to `.orc/<branch>/files/` (or `docs/` for ADRs/RFCs/postmortems).
5. **Done when** — the explicit success condition.
6. **Variants & gotchas** — common deviations and the rules that catch them.

## Mental model

orc maps the senior IC / tech-lead / architect day to a small set of composite commands. Most scenarios fit this loop:

```
   ┌──> /orc:plan ──> /orc:start ──> implement ──> /orc:qa ──> /orc:ship ──> /orc:cleanup
   │                                                                              │
   └──── (interrupted? /orc:resume) ──── (need status? /orc:status) ──────────────┘

         debugging      → /orc:debug
         someone's PR   → /orc:code-review
         your PR        → /orc:address
         decisions      → /orc:adr  (recorded)  /orc:rfc (proposed)
         incidents      → /orc:postmortem
         scaffolding    → /orc:scaffold
         parallel work  → /orc:fan-out
```

Pick the scenario that matches your situation and follow the steps.
