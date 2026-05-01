---
description: Pre-PR quality gate. For web changes, browser-driven QA via the agent-browser CLI — annotated screenshots, accessibility snapshot, console log, network HAR, and a step-by-step narrative saved to .orc/<branch>/files/qa/. No QA-passed claim without artifacts.
argument-hint: "[--web <url>] [--no-web] <feature description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(go *:*)
  - Bash(cargo *:*)
  - Bash(pytest *:*)
  - Bash(curl:*)
  - Bash(node:*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
---

# /orc:qa

Run a quality gate before opening a PR. Two modes:

- **Code/CLI/library change** — run tests, lint, type-check; verify with `orc:verification-before-completion`; do a self-review with `orc:caveman-review`. No browser.
- **Web change** — same as above PLUS browser-driven QA via `orc:agent-browser` and the `orc-qa-validator` agent. Evidence is saved to `.orc/<branch>/files/qa/`.

## Arguments

- `--web <url>` — explicit URL of running app (skips the auto-boot heuristic).
- `--no-web` — force code-only mode even if web files were touched.
- The remaining argument is the feature description (used to scope golden-path testing).

## Workflow

### Phase 1 — Detect web vs code

If `--no-web`: code mode. If `--web`: web mode. Otherwise heuristic: glob the diff for web surfaces (`.tsx`, `.jsx`, `.vue`, `.svelte`, `app/**/*.ts`, `pages/**`, `components/**`). If found, web mode; else code mode.

### Phase 2 — Tests + verification

Invoke `orc:verification-before-completion`. Run the project's test suite. Run lint and type-check if available. Confirm green output. If anything fails, stop and surface — QA cannot pass.

### Phase 3 — Self-review

Invoke `orc:caveman-review`. Review the staged or last-commit diff. Surface any findings to the user.

### Phase 4 (web mode only) — Browser QA

1. Init `.orc/<sanitized-branch>/files/qa/` directory.
2. Dispatch the `orc-qa-validator` subagent via `Task`. Pass:
   - The feature description.
   - The URL (or boot instructions).
   - The artifact directory.
3. The agent walks the golden path + edge cases, captures screenshots/video/console.log, writes `steps.md`, returns a verdict.
4. Read its `steps.md` and verdict. If `pass`, proceed. If `fail` or `partial`, surface the failure with the screenshot link to the user.

### Phase 5 — Write the verdict

Append to `.orc/<branch>/files/progress.md`:
```
## QA — <ISO-timestamp>
- Tests: pass/fail
- Lint: pass/fail
- Type-check: pass/fail
- Self-review findings: <count>
- Browser QA: <pass|fail|partial|skipped (code-only)>
- Artifact dir: .orc/<branch>/files/qa/  (if web mode)
```

Bump `checkpoint.md` to mark QA complete.

## Iron rule

For any web-mode QA, the `qa/` directory MUST contain all of:
- one or more `screenshot-NN-<step>.png` for the golden path (use `agent-browser screenshot --annotate` to overlay element refs)
- one or more screenshots for edge cases (or an explicit "no edge cases applicable, here's why" note in `steps.md`)
- `snapshot-final.txt` (final accessibility tree from `agent-browser snapshot`)
- `console.log` (from `agent-browser console`)
- `network.har` (from `agent-browser network har stop`)
- `steps.md` (the narrative)

Optional bonus evidence (NOT required): `trace.json` (Chrome DevTools trace), `react-renders.json`, `vitals.json`, an OS-recorded `video.mov`. Add these only when relevant to the change.

If any required artifact is missing, surface it and stop. The user must address the gap before any "ready to PR" claim.

## Output

- `.orc/<branch>/files/qa/...` (web mode)
- `.orc/<branch>/files/progress.md` (appended)
- Verdict echoed to the user
