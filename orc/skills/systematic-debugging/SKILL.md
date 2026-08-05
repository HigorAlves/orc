---
name: systematic-debugging
description: "Root-cause-first debugging discipline — build a red-capable feedback loop, minimise the repro, rank falsifiable hypotheses, fix at the source. Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes."
license: MIT
metadata:
  author: Jesse Vincent
  source: Derived from https://github.com/obra/superpowers; techniques merged from https://github.com/mattpocock/skills @ 2ffb184
---

# Systematic Debugging

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

This is orc iron rule #4. If you haven't completed Phase 1, you cannot propose fixes. Use this discipline for ANY technical issue — test failures, production bugs, build failures, performance problems — and ESPECIALLY under time pressure: systematic is faster than guess-and-check thrashing. Simple bugs have root causes too.

When running under `/orc:debug`, the phases below map onto the command's resumable session: the diagnosis persists to `.orc/<branch>/files/diagnosis.md` and checkpoints let `/orc:resume` continue an interrupted investigation.

Before exploring the codebase, read the project's context docs (`CONTEXT.md` if it exists) and ADRs in the area you're touching.

## Phase 1 — Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal that goes red on _this_ bug, you will find the cause — bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. Be aggressive. Be creative. Refuse to give up.

### Ways to construct one — try in roughly this order

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / `orc:agent-browser`) — drives the UI, asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** A minimal subset of the system (one service, mocked deps) that exercises the bug path with a single call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states, automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Same input through old vs new version (or two configs); diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive _them_ with `scripts/hitl-loop.template.sh` so the loop is still structured and its captured output feeds back to you.

### Tighten the loop

Treat the loop as a product. Once you have _a_ loop, tighten it:

- **Faster?** Cache setup, skip unrelated init, narrow the scope.
- **Sharper?** Assert on the specific symptom, not "didn't crash".
- **More deterministic?** Pin time, seed RNG, isolate filesystem, freeze network.

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is a debugging superpower.

**Non-deterministic bugs:** the goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows. A 50%-flake bug is debuggable; 1% is not — keep raising the rate.

**When you genuinely cannot build a loop:** stop and say so explicitly. List what you tried. Ask the user for (a) access to the reproducing environment, (b) a captured artifact (HAR file, log dump, core dump, recording with timestamps), or (c) permission to add temporary production instrumentation. Do NOT proceed to hypothesise without a loop.

### Completion criterion — one red-capable command

Phase 1 is done when you can name **one command** — a script path, a test invocation, a curl — that you have **already run at least once** (paste the invocation and its output), and that is:

- [ ] **Red-capable** — drives the actual bug code path and asserts the **user's exact symptom**, so it goes red on this bug and green once fixed. Not "runs without erroring".
- [ ] **Deterministic** — same verdict every run (flaky bugs: a pinned, high reproduction rate).
- [ ] **Fast** — seconds, not minutes.
- [ ] **Agent-runnable** — runs unattended; a human in the loop only via `scripts/hitl-loop.template.sh`.

If you catch yourself reading code to build a theory before this command exists, **stop — jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2.

## Phase 2 — Reproduce + minimise

Run the loop. Watch it go red. Confirm:

- [ ] The failure is the one the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] Reproducible across runs (or at a high enough rate to debug against).
- [ ] The exact symptom is captured (error message, wrong output, slow timing) so later phases can verify the fix addresses it.
- [ ] Recent changes checked — `git diff`, recent commits, new dependencies, config or environment drift.

Then **minimise**: shrink the repro to the smallest scenario that still goes red. Cut inputs, callers, config, and steps **one at a time**, re-running the loop after each cut. Done when every remaining element is load-bearing — removing any one makes the loop go green. A minimal repro shrinks the Phase 3 hypothesis space and becomes the clean regression test in Phase 5.

For errors deep in a call stack, trace the bad value backward to its origin — see `references/root-cause-tracing.md`. Fix at the source, not at the symptom.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea. Find working examples of similar code in the codebase and list every difference from the broken path — don't assume "that can't matter".

Each hypothesis must be **falsifiable** — state the prediction it makes:

> "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

**Show the ranked list to the user before testing.** They often re-rank instantly ("we just deployed a change to #3") or have already ruled hypotheses out. Cheap checkpoint, big time saver. Don't block on it — proceed with your ranking if the user is AFK.

## Phase 4 — Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses — in multi-component systems, log what enters and exits each component boundary to see WHERE it breaks before asking why.
3. Never "log everything and grep".

**Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup at the end becomes a single grep. Untagged logs survive; tagged logs die.

**Perf branch.** For performance regressions, logs are usually wrong. Establish a baseline measurement first (timing harness, profiler, query plan), then bisect. Measure first, fix second.

If a hypothesis dies, move to the next. **If 3+ fix attempts have failed, stop — that is not a failed hypothesis, it is a wrong architecture.** Each fix revealing new coupling in a different place is the tell. Question the pattern with your human partner before attempting more fixes.

## Phase 5 — Fix + regression test

Write the regression test **before the fix** (invoke `orc:tdd`) — but only if there is a **correct seam** for it: one where the test exercises the real bug pattern as it occurs at the call site. A too-shallow seam (unit test that can't replicate the triggering chain) gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it — the architecture is preventing the bug from being locked down — and flag it for Phase 6.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply ONE fix addressing the root cause — no "while I'm here" improvements, no bundled refactoring.
4. Watch it pass.
5. Re-run the Phase 1 loop against the original (un-minimised) scenario.

If the fix doesn't work, return to Phase 3 with the new evidence — don't stack another fix on top.

## Phase 6 — Cleanup + post-mortem

Required before declaring done (see `orc:verification-before-completion`):

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway harnesses deleted (or moved to a clearly-marked debug location)
- [ ] The winning hypothesis stated in the commit / PR / diagnosis — so the next debugger learns

**Then ask: what would have prevented this bug?** If the answer is architectural (no good test seam, tangled callers, hidden coupling), hand off to `orc:improve-codebase-architecture` with the specifics. Make that recommendation **after** the fix is in, not before — you know more now than when you started.

## Red flags — stop and return to Phase 1

"Quick fix for now, investigate later" · "Just try changing X and see" · "It's probably X, let me fix that" · proposing solutions before tracing data flow · skipping the loop because the issue "seems simple" · "one more fix attempt" after 2+ failures. All of these mean: STOP. No red-capable command, no fix.

## Supporting techniques (this directory)

- **`references/root-cause-tracing.md`** — trace bugs backward through the call stack to the original trigger (includes `scripts/find-polluter.sh` bisection)
- **`references/defense-in-depth.md`** — add validation at multiple layers after finding the root cause
- **`references/condition-based-waiting.md`** — replace arbitrary timeouts with condition polling
- **`scripts/hitl-loop.template.sh`** — structured human-in-the-loop repro when no automated loop is possible
