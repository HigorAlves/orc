<!-- orc:triage/BRIEFS -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Briefs and triage notes

The brief is the contract an AFK agent works from; the original body and discussion are only context.

## Principles

- Durable over precise — the item can sit for weeks while the codebase moves. Describe interfaces, types and behavioral contracts; never file paths or line numbers.
- Behavioral, not procedural — what the system must do, not how to implement it; the agent explores fresh.
- Complete acceptance criteria — each one independently verifiable ("running `x` returns `y`", not "works correctly").
- Explicit scope boundaries — name what must NOT change, so the agent does not gold-plate.

For a PR, "Current behavior" describes the state of the diff, and the brief asks the agent to finish or fix it rather than build from scratch.

## Agent brief template

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** one line on what needs to happen

**Current behavior:**
What happens now — the broken behavior (bug) or the status quo (enhancement).

**Desired behavior:**
What must happen when the work is done. Be specific about edge cases and errors.

**Key interfaces:**
- `TypeName` — what needs to change and why
- `functionName()` — current vs desired contract

**Acceptance criteria:**
- [ ] Specific, testable criterion
- [ ] Specific, testable criterion

**Out of scope:**
- Thing that must NOT be changed in this issue
```

## Needs-info template

```markdown
## Triage Notes

**What we've established so far:**

- point 1

**What we still need from you (@reporter):**

- specific, actionable question — never "please provide more info"
```

Capture everything resolved during grilling under "established so far" so the work survives.
