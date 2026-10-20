---
description: Pre-PR quality gate — browser-driven QA for web changes with a mandatory evidence packet against a provisioned environment. No QA-passed claim without artifacts. Workspace-aware. For a quick behavioral check without the evidence packet, prefer the bundled /verify or /run.
argument-hint: "[--auto[=guided|full]] [--target <name>] [--web <url>] [--no-web] [--no-env] [--driver playwright|agent-browser|chrome] [--repos a,b | --repo a | --all-repos | --this-repo] <feature description>"
allowed-tools:
  - Bash(orc-state:*)
  - Bash(orc-report:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(go:*)
  - Bash(cargo:*)
  - Bash(pytest:*)
  - Bash(curl:*)
  - Bash(node:*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
  - Bash(orc-workspace-detect:*)
  - Bash(orc-docker-env:*)
  - Bash(acli:*)
  - Bash(jq:*)
  - Bash(git branch --show-current:*)
  - Bash(orc-targets:*)
  - Bash(npx playwright:*)
  - Bash(orc-playwright:*)
  - Bash(orc-qa-video:*)
  - Bash(gh pr comment:*)
  - Bash(gh pr view:*)
  - Bash(gh auth status:*)
effort: high
---

# /orc:qa

Run the quality gate before a PR: tests, lint, type-check, self-review, and browser QA with an evidence packet for web changes.

Two modes:

- Code, CLI or library change: suite, lint, type-check, verification, self-review. No browser.
- Web change: the same, plus browser QA under one driver per run (`orc:browser-qa` driver gate).

Drivers: P `playwright` (default), A `agent-browser` via `orc-qa-validator`, B Claude-in-Chrome inline. Every driver saves evidence to `.orc/<branch>/files/qa/`.

## Arguments

- `--auto[=guided|full]` — autopilot level for this run (overrides `interaction_policy`); ladder and hard-outward exemption in `orc:gates` §6.
- `--target <name>` — a named QA target from `.orc/targets.json` (`orc:qa-targets`). Omitted: the Target gate asks.
  - `local` provisions the Docker env; the command probes a remote target (staging, preview) and uses it as-is.
- `--web <url>` — ad-hoc remote shorthand: the app is up. Skips env provisioning and the validator's boot path.
- `--no-web` — force code mode even when the diff touches web files.
- `--no-env` — skip Docker env provisioning; the validator falls back to its legacy dev-script boot.
- `--driver playwright|agent-browser|chrome` — pick the driver up front; skips the `orc:browser-qa` driver gate.
  - `playwright` — Playwright Test with the planner, generator and healer agents; tests under `e2e/`, stitched step-tagged video, traces.
  - `agent-browser` — headless CLI via `orc-qa-validator`: criterion-anchored annotated screenshots, WebM when `ffmpeg` exists, HAR, network mocking.
  - `chrome` — Claude-in-Chrome extension inline; the user watches live (real sessions, extensions, GIF recording).
- The remaining text is the feature description; it scopes golden-path testing.

## Preconditions

> **🛑 No pass without evidence**
>
> A web-mode run with a missing artifact or an unscored criterion is incomplete evidence, never a pass.

- A failing suite, lint or type-check in P2 stops the run; QA cannot pass.
- Web mode needs one reachable target: `--target`, `--web`, or the Target gate (`orc:qa-targets`).

## Phases

Modules live in `orc:phases` (`references/qa/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Detect mode | resident, below | never |
| 2 Tests and verification | `orc:qa/P2` | never |
| 3 Self-review, security pass | `orc:qa/P3` | never |
| 4 Browser QA | `orc:qa/P4` | code mode |
| 5 Write the verdict | `orc:qa/P5` | never |
| 6 Publish evidence | `orc:qa/P6` | code mode |
| Packet contract | `orc:qa/PACKET` | code mode (P5 reads it) |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; `ORC_*` vars are exported. Do not re-run detection.
2. In workspace mode, resolve `targetRepos` from flags or via `AskUserQuestion`.
3. Pick the single web-QA repo from the plan's "Repo touchpoints"; if ambiguous, ask.

NOTE: the workspace default verifies every repo in the active session's `repos` array. The web-QA target is always one repo: the entry that owns the web surface.

### Phase 1 — Detect mode

1. If `--no-web`, use code mode.
2. If `--web`, use web mode.
3. Otherwise glob the diff for the web surfaces below.
4. If any match, use web mode; else code mode.

Web surfaces: `.tsx`, `.jsx`, `.vue`, `.svelte`, `app/**/*.ts`, `pages/**`, `components/**`.

## Iron rules

- In web mode, `qa/` holds the driver's full packet per `orc:qa/PACKET`; a missing artifact blocks.
- A change to a rendered surface needs motion proof; an exemption goes as a one-line reason in `steps.md`.
- Every acceptance criterion appears in `qa-manifest.json` with a result; a `skipped` row says why.
- The verdict follows the mechanical rule in `orc:qa/P5`. Agents never decide it.
- The chrome driver trades HAR-grade capture for live visibility; its packet stays mandatory in full.
- Bonus evidence (`trace.json`, `react-renders.json`, `vitals.json`) is optional; add it only when relevant.

## Output

- `.orc/<branch>/files/qa/...` (web mode).
- `${ORC_STATE_DIR}/<sanitized-branch>/files/qa-verdict.json`, what ship and flow gates read.
- `.orc/<branch>/files/progress.md` (appended).
- Ticket delivery outcome in `steps.md` (web mode, via `orc:evidence-publish`).
- The verdict, echoed to the user.
