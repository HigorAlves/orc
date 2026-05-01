# 01 — Fixing a bug

## Scenario

A user reports: *"The billing page shows `$NaN` for some users on the team plan."* You can reproduce it locally. Now what?

The temptation is to grep for `NaN`, find the line, slap a `|| 0` on it, and ship. orc refuses to let you do that — iron rule #4 says find the root cause first.

## Flow

```
/orc:debug "billing page shows $NaN for users on the team plan"
       └─→ orc-debug-investigator (root cause, not fix)
              └─→ TDD: write failing regression test
                     └─→ orc-code-fixer (apply the fix)
                            └─→ orc:verification-before-completion
                                   └─→ /orc:qa --web (browser evidence)
                                          └─→ /orc:ship
```

## Walk-through

### Phase 1 — Investigation (no fixes)

```
/orc:debug "billing page shows $NaN for users on the team plan"
```

`/orc:debug` dispatches **`orc-debug-investigator`** — a long-running subagent that does NOT touch code. It returns a written diagnosis to `.orc/<branch>/files/diagnosis.md` containing:

- Reproduction steps (minimal repro)
- Root cause (file:line + mechanism + introducing commit)
- Recommended fix surface (which files to change)
- Recommended regression test (what to assert and at what level)

Example output:

```
## Root cause
The bug is at `src/billing/usage.ts:142` — the `if (!entitlement.cap)` branch
returns falsy for legitimately-zero `cap` values (free tier with 0 included
units), so `usage / cap` divides by undefined and renders as NaN.
Introduced in `a3f7b21` when `cap` was migrated from `number | null` to
`number` and the null check was kept by mistake.

## Reproduction
1. Sign in as a team-plan user with 0 included units consumed
2. Open /billing
3. Observe: usage shows "$NaN of $undefined"

## Recommended fix surface
- `src/billing/usage.ts:142` — guard with `cap === 0` short-circuit
- `src/billing/__tests__/usage.test.ts` — add regression test

## Recommended regression test
Unit test in usage.test.ts: given cap=0 and used=0, expect formatted output
to be "$0 of $0", not "$NaN of $undefined".
```

### Phase 2 — Confirm

`AskUserQuestion`:
- "Diagnosis looks right — proceed with fix"
- "Need more investigation"
- "Diagnosis is wrong — abort"

### Phase 3 — Write the regression test (TDD red)

`/orc:debug` invokes `orc:tdd`. You write the test from the diagnosis, run the suite, watch it fail with the expected message. Commit the failing test on a fix branch (you're already on one — the worktrees skill handled that).

### Phase 4 — Fix

`orc-code-fixer` agent receives the diagnosis + the now-failing test, applies the fix, re-runs the suite. Reports back: which files changed, test pass/fail counts.

### Phase 5 — Verify

`orc:verification-before-completion` runs the full suite, lint, type-check. No "looks fine" without seeing green output.

### Phase 6 — Web QA (if visible to users)

```
/orc:qa --web http://localhost:3000
```

For a billing-page bug, this is required (iron rule: web changes need browser-driven QA evidence). `orc-qa-validator` walks the golden path + edge cases, captures `.orc/<branch>/files/qa/screenshot-NN-*.png`, `console.log`, `network.har`, `steps.md`.

### Phase 7 — Ship

```
/orc:ship
```

Composes commit message ("fix(billing): guard zero-cap users against NaN"), opens PR with the diagnosis as a `## Why` block.

## Artifacts

```
.orc/fix-billing-nan/files/
├── checkpoint.md              # phase: done
├── diagnosis.md               # the root-cause writeup
├── progress.md                # phase log
└── qa/
    ├── screenshot-01-billing-loaded.png
    ├── screenshot-02-zero-cap-formatted-correctly.png
    ├── steps.md
    ├── console.log
    └── network.har
```

## Done when

- The regression test passes (proves the bug is captured).
- The full suite passes.
- For web: `qa/` has the required artifacts.
- The PR is open with diagnosis linked from the body.
- Post-merge: `/orc:cleanup` removes the worktree + state.

## Variants

- **Performance regression, not a logic bug** — same flow. `orc-debug-investigator` is good for "this got 3× slower" too; the diagnosis just describes the regression mechanism instead.
- **Can't reproduce locally** — the investigator surfaces this *first*. Don't spend hours guessing — get a customer's session ID, a Sentry trace, or a feature flag state from the user before re-running `/orc:debug`.
- **The "fix" is a workaround** — fine for a hotfix, but write a follow-up issue immediately. orc treats workarounds as debt, not solutions.

## Iron rules in play

- **#3 — No claims without verification.** The verify phase isn't optional.
- **#4 — No fixes without root cause.** This is the whole point of `/orc:debug`.
- **Web QA evidence rule.** For UI changes, screenshots+steps+console+HAR or it didn't pass QA.
