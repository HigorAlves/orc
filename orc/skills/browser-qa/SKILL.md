---
name: browser-qa
description: The canonical browser-QA protocol for web changes — env attach, the driver gate (agent-browser headless vs Claude-in-Chrome live), the validator dispatch contract, and the chrome-mode evidence packet. Use when running browser QA on a web change; /orc:qa Phase 4 and /orc:flow Phase 6 delegate here.
---

# Browser QA

The single source of truth for driving browser QA — `/orc:qa` and `/orc:flow` both execute this protocol instead of restating it. Inputs from the caller: the feature description, the state dir, `--driver`/`--web`/`--no-env` flags when given, and (workspace mode) the web-surface repo + siblings.

## Step 0 — Provision or attach the environment

Skip when `--web <url>` or `--no-env`. Check `orc-docker-env is-ready $(orc-docker-env state-path "$ORC_STATE_DIR" <sanitized-branch>)`:

- `ready` → attach; echo the reuse line (project, appUrl, "reused").
- otherwise → dispatch **`orc-env-provisioner`** via `Task` (repoPath = the worktree; workspace mode adds `repos[]`, `webSurfaceRepo`, plan path). On `fallback`: re-print the agent's ⚠️ callout and continue. On `failed`: re-print the 🛑 callout and `AskUserQuestion` — retry / retry `--fresh` / continue with `--no-env` legacy boot / abort QA.

The environment **stays up after QA** — the "QA partial → fix → re-run" loop attaches in seconds. Teardown belongs to `/orc:cleanup`. Then init `${ORC_STATE_DIR}/<sanitized-branch>/files/qa/`; in workspace mode, cross-repo integration evidence goes there while per-repo QA stays at `<repoPath>/.orc/<branch>/files/qa/`.

## Step 1 — Choose the driver

If `--driver` was passed or the session has a settled `driver` decision, use it silently. Otherwise print the Gate headline, then `AskUserQuestion` (record the answer via `orc-state decision set driver <v> --provenance asked` — re-runs keep the same driver unless the user asks to switch):

```markdown
> **⛔ Gate — browser driver**
>
> Web QA is ready to run against <appUrl>. Pick how to drive the browser.
```

- **agent-browser CLI (headless)** — richest evidence: annotated screenshots, network HAR, request mocking for failure-state testing; runs isolated from your browsing. Best for thorough pre-PR gates and CI-like rigor.
- **Claude-in-Chrome extension (watch live)** — the test runs in YOUR Chrome; you see every click as it happens, with your real sessions, cookies, and extensions. Best when you want to visually follow the flow or the app needs an already-logged-in state.

## Driver A — agent-browser (dispatch the validator)

Dispatch the `orc-qa-validator` subagent via `Task`. Pass:

- The feature description.
- **`appUrl` + `serviceEndpoints` + `envStatePath`** from `docker-env-state.json` (the validator NEVER boots infra when env state exists — it attaches). Only when step 0 was skipped: the `--web` URL, or legacy boot instructions under `--no-env`.
- The artifact directory.
- When the session has a `slices.json` ledger: the relevant slices' **`acceptance` lists** — the agent scores each criterion against observed behavior (evidence-cited), instead of narrating vibes.
- **Workspace mode only**: `repo` (the web-surface repo), `repoPath`, `siblingRepos` (already running via the provisioned environment — verify their traffic through `serviceEndpoints` in the HAR; the agent does NOT touch them), and `crossRepoContract` (when present in the plan — the agent walks an integration golden path that exercises the contract end-to-end).

The agent walks the golden path + edge cases, captures the evidence, writes `steps.md`, and returns its verdict + **manifest** (artifact list, curated visual-proof selection, per-acceptance results, 3-line summary). **Consume the manifest — do NOT re-read `steps.md`.** `pass` → proceed; `fail`/`partial` → surface the failure with the screenshot link from the manifest. The evidence-publish step takes the same manifest as its pre-curated payload.

## Driver B — Claude-in-Chrome (run inline; the user is watching)

Do NOT dispatch `orc-qa-validator` — the extension binds to the user's browser through THIS session. Run the QA yourself, narrating each step in one short line as you go:

1. Load the extension tools in ONE `ToolSearch` call: `tabs_context_mcp`, `navigate`, `computer`, `read_page`, `tabs_create_mcp`, `read_console_messages`, `read_network_requests`, `gif_creator` (+ `form_input` when the flow has forms). Call `tabs_context_mcp` first; if the extension is not connected, surface it and fall back to Driver A (note the switch — never silently).
2. **Create a NEW tab** for the appUrl — never drive the user's existing tabs unless they explicitly asked. Start a GIF recording via `gif_creator` (name it `qa-<sanitized-branch>.gif`, capture extra frames around each action). Avoid any element that triggers JS `alert`/`confirm` dialogs — they freeze the extension; test those paths under Driver A instead.
3. Walk the **same golden path + edge cases** the `orc-qa-validator` protocol prescribes (validation errors, empty state, failure state where reachable without request mocking, auth states). One-line narration per step.
4. Capture the chrome-mode evidence packet into `<qa-dir>` via `Write`:
   - `qa-<branch>.gif` — the recording (replaces per-step screenshot files; in-conversation screenshots are referenced by step number in `steps.md`)
   - `snapshot-final.txt` — final `read_page` output
   - `console.log` — `read_console_messages` output (filter noise with `pattern` but state the filter used)
   - `network-summary.md` — distilled `read_network_requests` output: method, endpoint, status per request + notable bodies (replaces `network.har`)
   - `steps.md` — same template and verdict rules as the validator's
5. Same verdict handling: `pass` → proceed; `fail`/`partial` → surface with the failing step + console/network line.

## Iron rule

No "QA passed" claim without the evidence packet on disk — whichever driver ran. The caller computes the session verdict mechanically (`qa-verdict.json` per `orc:state-protocol`); this protocol's browser verdict is one input to it.
