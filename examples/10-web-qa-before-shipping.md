# 10 — Web QA before shipping

## Scenario

You just finished implementing a redesign of the checkout error states (from generic "Something went wrong" to specific, actionable messages per error type). Tests pass. Lint passes. You're tempted to open the PR.

orc says no — not yet. Web change → web QA evidence → only then ship.

## Why this exists

orc's iron rule: **for any change touching a web surface, no "QA passed" claim is accepted without browser-driven evidence in `.orc/<branch>/files/qa/`.**

Why?

- Unit tests don't cover the user-perceived experience (skeleton states, animations, focus flow, screen-reader output).
- "Looks fine to me" doesn't generate artifacts a reviewer can re-verify.
- Every change-to-prod-incident postmortem we'd ever write would have caught the bug if someone had walked the golden path in a real browser.

So we encode the discipline.

## Flow

```mermaid
flowchart TD
    cmd["/orc:qa --web http://localhost:3000"]
    detect[Detect web vs code mode<br/><i>heuristic on changed files</i>]
    verify[Tests + lint + type-check<br/>orc:verification-before-completion]
    selfrev["Self-review of diff<br/>orc:caveman-review<br/>(+ orc-security-reviewer if sensitive)"]
    boot[Boot + browser QA<br/>orc-qa-validator + agent-browser]
    golden[Walk golden path]
    edge[Walk edge cases<br/><i>validation, empty, failure,<br/>slow network, auth states</i>]
    capture[Capture artifacts to<br/>.orc/&lt;branch&gt;/files/qa/]
    verdict{Verdict:<br/>pass | partial | fail}

    cmd --> detect --> verify --> selfrev --> boot
    boot --> golden --> capture
    boot --> edge --> capture
    capture --> verdict
```

## Walk-through

### Phase 1 — Detect mode

If you didn't pass `--web`/`--no-web`, the command checks the diff:

```bash
gh pr diff <ref> --name-only 2>/dev/null || git diff main --name-only
```

If any file matches web surfaces (`.tsx`, `.jsx`, `.vue`, `.svelte`, `app/**/*.ts`, `pages/**`, `components/**`) → **web mode**. Otherwise code mode.

For your checkout-error-states change, several `.tsx` files changed → web mode.

### Phase 2 — Tests + lint + type-check

`orc:verification-before-completion`:

```bash
npm test
npm run lint
npm run typecheck
```

All green. If anything red: stop here. QA cannot pass.

### Phase 3 — Self-review

`orc:caveman-review` reads your staged diff (or last-commit diff). Returns terse findings, if any:

```
## Bugs
(none)

## Tests
- src/checkout/error-state.tsx:42–60 — new error-message branch untested for INSUFFICIENT_FUNDS — add test
```

You add the test, re-run Phase 2. Now clean.

### Phase 4 — Browser QA

```
.orc/feat-checkout-error-states/files/qa/
```

Created. `orc-qa-validator` is dispatched via `Task`. The agent's first move is to invoke the `orc:agent-browser` skill (the discovery stub points at the live CLI workflow).

Then it walks the **golden path**:

```bash
agent-browser open http://localhost:3000/checkout
agent-browser network har start
agent-browser snapshot
agent-browser screenshot --annotate qa/screenshot-01-checkout-loaded.png

agent-browser fill @e3 "4242424242424242"  # card number
agent-browser fill @e4 "12/30"
agent-browser fill @e5 "123"
agent-browser screenshot --annotate qa/screenshot-02-form-filled.png

agent-browser click @e7  # Submit
agent-browser wait --text "Payment confirmed"
agent-browser screenshot --annotate qa/screenshot-03-success.png
```

And the **edge cases** (specific to this change):

```bash
# Validation: bad card number
agent-browser fill @e3 "1111111111111111"
agent-browser click @e7
agent-browser wait --text "Card number is invalid"
agent-browser screenshot --annotate qa/screenshot-04-card-invalid.png

# Failure: API 500
agent-browser network route "**/api/checkout" --body '{"error":"server"}'
agent-browser click @e7
agent-browser wait --text "Something went wrong"   # ← this is what we're testing!
agent-browser screenshot --annotate qa/screenshot-05-server-error.png

# Failure: insufficient funds (specific message)
agent-browser network route "**/api/checkout" --body '{"error":"INSUFFICIENT_FUNDS","message":"Your card was declined."}'
agent-browser click @e7
agent-browser wait --text "Your card was declined"
agent-browser screenshot --annotate qa/screenshot-06-declined.png

# Empty cart edge case
agent-browser open http://localhost:3000/checkout?cart=empty
agent-browser screenshot --annotate qa/screenshot-07-empty-cart.png
```

After: capture the rest of the artifacts:

```bash
agent-browser network har stop qa/network.har
agent-browser console > qa/console.log
agent-browser snapshot > qa/snapshot-final.txt
agent-browser close
```

The agent then writes `qa/steps.md` — a numbered narrative referencing each screenshot.

### Phase 5 — Verdict

The agent returns a verdict — `pass`, `partial`, or `fail`. Example summary:

```
QA — checkout error states — 2026-05-01

Golden path: ✅ all 3 steps green
Edge cases: ✅ 4 of 4 (card-invalid, server-error, declined, empty-cart)
Console: 0 errors / 1 warning (deprecation notice from a library, unrelated)
Network: 8 requests, 0 unexpected 4xx/5xx

Verdict: pass
```

If `fail`: a screenshot + the failing console/network line is surfaced; you don't ship until it's fixed.

### Phase 6 — Write the verdict

Appended to `.orc/feat-checkout-error-states/files/progress.md`:

```
## QA — 2026-05-01T14:22Z
- Tests: pass
- Lint: pass
- Type-check: pass
- Self-review findings: 0 (after one round of fix)
- Browser QA: pass
- Artifact dir: .orc/feat-checkout-error-states/files/qa/
```

`checkpoint.md` bumps to `qa-complete`.

## Required artifacts (the hard rule)

The `qa/` directory MUST contain all of:

- ≥ 1 `screenshot-NN-<step>.png` for the golden path (annotated)
- ≥ 1 `screenshot-NN-<step>.png` for edge cases (or explicit "no edge cases applicable, here's why" in `steps.md`)
- `snapshot-final.txt`
- `console.log`
- `network.har`
- `steps.md`

**Optional bonus** (when relevant): `trace.json` (Chrome DevTools trace), `react-renders.json`, `vitals.json`, OS-recorded `video.mov`. agent-browser doesn't record video natively.

If anything required is missing, the QA is NOT passed. The command surfaces the gap and stops.

## Artifacts

```
.orc/feat-checkout-error-states/files/qa/
├── screenshot-01-checkout-loaded.png
├── screenshot-02-form-filled.png
├── screenshot-03-success.png
├── screenshot-04-card-invalid.png
├── screenshot-05-server-error.png
├── screenshot-06-declined.png
├── screenshot-07-empty-cart.png
├── snapshot-final.txt
├── console.log
├── network.har
└── steps.md
```

## Done when

- Verdict is `pass`.
- All required artifacts exist.
- `progress.md` has the verdict block.
- `checkpoint.md` reflects QA complete.

Then: `/orc:ship` — and the PR body links to `qa/steps.md` so reviewers can verify the evidence.

## Variants

- **Pure backend change (no UI files in diff)** — code mode. No browser. No `qa/` artifacts. Verification + self-review only.
- **Animation-heavy change** — add an OS screen recording manually (`screencapture -v qa/video.mov` on macOS). It's optional, but for visual regressions it's the most useful single artifact.
- **Multiple devices/breakpoints** — repeat the golden path with `agent-browser set viewport <w> <h>` for each. Save screenshots per breakpoint (`screenshot-01a-mobile-loaded.png`, `screenshot-01b-desktop-loaded.png`).
- **Behind a feature flag** — boot the app with the flag enabled, document the flag state at the top of `steps.md`.
- **App not yet boot-able locally** — ask the user for a deployed preview URL (Vercel preview, staging, etc.). Don't fake QA against the prod app.

## Iron rules in play

- **Web QA evidence rule** — non-negotiable. No artifacts, no QA-passed claim.
- **#3 — verify before claim.** This is the rule's whole point.
- **Annotated screenshots are the cheap big-win** — `--annotate` overlays element refs (`@e1`, `@e2`...), so a reviewer reading `steps.md` later can correlate "click @e2" with the labeled button in the PNG. Higher-value than a raw screenshot.

## What NOT to do

- Don't replace browser QA with "I read the React component tree." That's not QA; that's code review.
- Don't skip edge cases because "the unit tests cover them." Unit tests cover the function; QA covers the user.
- Don't claim `pass` without all required artifacts present. The rule is the rule.
- Don't simulate the browser if `agent-browser` isn't installed — surface the gap (the SessionStart tool-check hook may already have warned about this) and stop.
