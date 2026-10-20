# `steps.md` template (orc-qa-validator)

```
# QA — <feature name> — <ISO date>

App: <URL>
Build: <commit-sha-short>
agent-browser: <agent-browser --version output>

## Golden path

1. **Open <page>** — expected: <…> — actual: <…> — ![](screenshot-01-open.png)
2. **Fill form with valid data** — expected: <…> — actual: <…> — ![](screenshot-02-filled.png)
3. **Submit** — expected: redirect to /dashboard — actual: <…> — ![](screenshot-03-success.png)

## Acceptance criteria

| Criterion | Result | Evidence |
|---|---|---|
| slice-3-ac-1 — POST /export returns 202 + Location header | pass | ac-3-1-export-202.png |
| slice-3-ac-2 — Toast reads "Export queued" | fail | ac-3-2-toast.png (toast never renders) |
| slice-3-ac-3 — Retry after 24h resets quota | skipped | not reachable in a browser session — needs a clock-shift harness |

## Edge cases

### Validation errors
1. **Submit empty required field** — expected: inline error "Email is required" — actual: <…> — ![](screenshot-04-validation.png)

### Empty state
1. **First-time user, no data** — expected: empty-state CTA visible — actual: <…> — ![](screenshot-05-empty.png)

### Failure state (API 500)
1. **Block /api/billing** — expected: error toast "Could not load billing" — actual: <…> — ![](screenshot-06-error.png)

## Console
- <error count> errors / <warning count> warnings
- Notable line(s): "Uncaught TypeError ..." (console.log:42)

## Network (from HAR)
- Requests: <count>
- 4xx/5xx: <count>
- Notable: <e.g. "POST /api/refund returned 200 with body {ok: true}">

## Verdict

✅ Golden path passes; edge cases pass; no console errors.

or

❌ Golden path fails at step 3 — Submit silently no-ops. Console shows `Uncaught TypeError: cannot read property 'token' of undefined` (console.log:14). See screenshot-03-submit-failure.png.
```

Motion proof line, when ffmpeg is absent: `Motion proof: skipped — ffmpeg not installed`. When the change is not visual: `Motion proof: skipped — non-visual change`.
