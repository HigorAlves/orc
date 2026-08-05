---
name: tdd
description: Test-driven development with the red-green-refactor loop. Use when building features or fixing bugs via TDD, requesting integration tests, or asking for test-first development.
license: MIT
metadata:
  source: Derived from https://github.com/mattpocock/skills (audit pin 2ffb184)
---

# Test-Driven Development

TDD is the red → green → refactor loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the named anti-patterns, and the rules of the loop. This is orc iron rule #2 — the failing test comes before the production code, every cycle.

When exploring the codebase, use the project's domain glossary (and `CONTEXT.md` if it exists) so test names and interface vocabulary match the project's language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists — and survives refactors because it doesn't care about internal structure.

See [references/tests.md](references/tests.md) for good/bad examples and [references/mocking.md](references/mocking.md) for mocking guidelines.

## Seams — where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything — agreeing the seams up front is how testing effort lands on critical paths and complex logic instead of every possible edge case.

Ask: "What should the public interface look like, and which seams should we test?"

When the shape of the interface is itself in question — how deep the module is, where the seam belongs — consult `orc:codebase-design` for the module/interface/depth/seam vocabulary, plus [references/deep-modules.md](references/deep-modules.md) (small interface, deep implementation) and [references/interface-design.md](references/interface-design.md) (designing for testability).

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth — a known-good literal, a worked example, the spec.
- **Horizontal slicing** — writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead — one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

```
WRONG (horizontal):          RIGHT (vertical):
  RED:   test1..test5          RED→GREEN: test1→impl1
  GREEN: impl1..impl5          RED→GREEN: test2→impl2
                               ...
```

## Workflow

### 1. Plan

Before writing any code:

- [ ] Confirm with the user what interface changes are needed
- [ ] Confirm the seams under test and which behaviors matter most (prioritize)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

### 2. Tracer bullet

Write ONE test that confirms ONE thing about the system. RED: it fails. GREEN: minimal code to pass. This proves the path works end-to-end.

### 3. Incremental loop

For each remaining behavior: write the next test → watch it fail → minimal code to pass. Rules:

- **Red before green.** Write the failing test first, then only enough code to pass it.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- Don't anticipate future tests or add speculative features.

### 4. Refactor

After the suite is green, look for [refactor candidates](references/refactoring.md): extract duplication, deepen modules, apply what the new code reveals about existing code. Run the tests after each refactor step. **Never refactor while RED.**

## Checklist per cycle

```
[ ] Test written at a pre-agreed seam
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Expected values from an independent source of truth
[ ] Code is minimal for this test
[ ] No speculative features added
```

## Rejected framings

- **"Refactoring is not part of the loop"** (upstream mattpocock/skills tdd) — evaluated and REJECTED. Upstream defers refactoring to the review stage; orc keeps it as step 4 of the cycle because the orc-implementer slice loop (step 8: refactor if the green code is ugly, re-run the suite) depends on the refactor step running against a green suite before the per-slice commit. Future audits should not re-propose removing it.
