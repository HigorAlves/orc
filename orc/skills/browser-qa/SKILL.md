---
name: browser-qa
description: The canonical browser-QA protocol for web changes — target resolution, env attach, the driver gate (Playwright primary, agent-browser, Claude-in-Chrome), validator dispatch, chrome evidence packet
when_to_use: Use when running browser QA; /orc:qa and /orc:flow Phase 6 delegate here.
---

# Browser QA

The single source of truth for driving browser QA — `/orc:qa` and `/orc:flow` both execute this protocol instead of restating it. Inputs from the caller: the feature description, the state dir, `--driver`/`--web`/`--no-env` flags when given, and (workspace mode) the web-surface repo + siblings.

## Step 0 — Resolve the target

Invoke `orc:qa-targets`: `--target` / `--web` / settled decision / the Target gate. Result: a target **name** (plus a `--base-url` override when one applies) and `guard`. The resolved JSON is never produced here — the engine resolves it inline in the command that consumes it (`orc:qa-targets` iron rule). Remote target ⇒ probe; unreachable ⇒ `🛑 Escalation — target unreachable`, stop.

## Step 1 — Provision or attach the environment (local target only)

Skip for remote targets and under `--no-env`. Check `orc-docker-env is-ready $(orc-docker-env state-path "$ORC_STATE_DIR" <sanitized-branch>)`:

- `ready` → attach; echo the reuse line (project, appUrl, "reused").
- otherwise → dispatch **`orc-env-provisioner`** via `Task` (repoPath = the worktree; workspace mode adds `repos[]`, `webSurfaceRepo`, plan path). On `fallback`: re-print the agent's ⚠️ callout and continue. On `failed`: re-print the 🛑 callout and `AskUserQuestion` — retry / retry `--fresh` / continue with `--no-env` legacy boot / abort QA.

Record `<appUrl>` as the `--base-url` override for the `local` target (the engine resolves inline). The environment **stays up after QA** — the "QA partial → fix → re-run" loop attaches in seconds. Teardown belongs to `/orc:cleanup`. Init `${ORC_STATE_DIR}/<sanitized-branch>/files/qa/`; in workspace mode, cross-repo integration evidence goes there while per-repo QA stays at `<repoPath>/.orc/<branch>/files/qa/`.

## Step 1b — Choose the driver

If `--driver` was passed or the session has a settled `driver` decision, use it silently. Otherwise print the Gate headline, then `AskUserQuestion` (re-runs keep the same driver unless the user asks to switch):

```markdown
> **⛔ Gate — browser driver**
>
> Web QA is ready to run against <target name> (<baseUrl>). Pick how to drive the browser.
```

- **Playwright (Recommended)** — plans and generates real Playwright tests committed with your change (`e2e/`), heals flaky locators, and records a stitched video whose on-screen tags name each criterion as it is proven; traces per scenario. Needs Node; first use creates `e2e/` behind a gate.
- **agent-browser CLI (headless)** — one-off walk with annotated screenshots, HAR, request mocking, WebM when ffmpeg is installed. No tests left behind. Used automatically when Node is unavailable.
- **Claude-in-Chrome extension (watch live)** — the test runs in YOUR Chrome with your sessions and extensions; GIF recording, no external tooling.

Record: `orc-state decision set driver <playwright|agent-browser|chrome> --provenance asked`. `guided`/`full` ⇒ `playwright` as a policy decision.

## Step 2 — Load the acceptance criteria (all drivers)

Before driving anything, read the session's `slices.json` ledger and collect the relevant slices' **`acceptance` lists**. These are the scoring rubric — the walk exists to prove them, not to tour the app. Every criterion ends the run as `pass`, `fail`, or `skipped` **with a stated reason**, each carrying the artifact that proves it.

No ledger (ad-hoc QA, `/orc:evidence` against a ticket) ⇒ distil the criteria from the feature description or ticket body instead; the scoring contract is identical.

## Driver P — Playwright (delegate)

Invoke `orc:playwright-qa` with the inputs listed in its header (feature description, `<qa-dir>`, the step-2 acceptance lists, target name + optional `--base-url` override + `guard` (never the resolved JSON), `isVisual`; workspace mode adds the web-surface `repoPath`). It returns `pass|fail|partial` with `qa-manifest.json` written, or `fallback` (Node missing, setup declined, MCP not connected) — on `fallback` print the reason and run **Driver A** below with the same inputs; never silently.

## Driver A — agent-browser (dispatch the validator)

Dispatch the `orc-qa-validator` subagent via `Task` and read its `qa-manifest.json` for the verdict. Read [DRIVER-A.md](references/DRIVER-A.md) when this driver runs: the full input list (env state, acceptance lists, visual flag, workspace inputs) and the verdict handling.

## Driver B — Claude-in-Chrome (run inline; the user is watching)

Do NOT dispatch `orc-qa-validator` — run the QA yourself in a new tab, narrating each step. Read [DRIVER-B.md](references/DRIVER-B.md) when this driver runs: the tool load, the walk, the chrome-mode evidence packet, and the stated evidence trade-off.

## Iron rule

No "QA passed" claim without the evidence packet on disk — whichever driver ran. Every acceptance criterion from step 2 appears in `qa-manifest.json` with a result; `skipped` requires a stated reason. The caller computes the session verdict mechanically (`qa-verdict.json` per `orc:state-protocol`); this protocol's browser verdict is one input to it.
