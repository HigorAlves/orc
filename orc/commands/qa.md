---
description: Pre-PR quality gate — browser-driven QA for web changes with a mandatory evidence packet against a provisioned environment. No QA-passed claim without artifacts. Workspace-aware. For a quick behavioral check without the evidence packet, prefer the bundled /verify or /run.
argument-hint: "[--auto[=guided|full]] [--web <url>] [--no-web] [--no-env] [--driver agent-browser|chrome] [--repos a,b | --repo a | --all-repos | --this-repo] <feature description>"
allowed-tools:
  - Bash(orc-state:*)
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
effort: high
---

# /orc:qa

Run a quality gate before opening a PR. Two modes:

- **Code/CLI/library change** — run tests, lint, type-check; verify with `orc:verification-before-completion`; do a self-review with `orc:caveman-review`. No browser.
- **Web change** — same as above PLUS browser-driven QA, with a **driver chosen per run** (Phase 4.1): the `agent-browser` CLI via the `orc-qa-validator` agent (headless, richest evidence), or the **Claude-in-Chrome extension** run inline in this session (the user watches the test live in their own browser). Evidence is saved to `.orc/<branch>/files/qa/` either way.

## Arguments

- `--auto[=guided|full]` — autopilot level for this run (overrides `interaction_policy`; taxonomy in `orc:using-orc`). Soft-inward gates consult the resolved policy — `guided` auto-advances mechanical confirms with a printed one-liner; `full` pre-approves them from settled decisions (`orc:state-protocol`), stopping only on escalation-only conditions. Hard-outward gates are unaffected at every level.

- `--web <url>` — explicit URL of a running app (skips env provisioning AND the validator's boot path — you're saying it's already up).
- `--no-web` — force code-only mode even if web files were touched.
- `--no-env` — skip Docker env provisioning; the validator falls back to its legacy dev-script boot.
- `--driver agent-browser|chrome` — pick the browser driver up front and skip the Phase 4.1 prompt. `agent-browser` = headless CLI via `orc-qa-validator` (annotated screenshots, HAR, network mocking). `chrome` = Claude-in-Chrome extension, run inline so the user watches live in their real browser (real sessions/extensions, GIF recording).
- The remaining argument is the feature description (used to scope golden-path testing).

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection).

In workspace mode, resolve `targetRepos` from flags or via `AskUserQuestion`. Default in workspace mode is to verify every repo in the active workspace session's `repos` array. The web-QA target is always **one** repo — pick from the plan's "Repo touchpoints" section (the entry that owns the web surface) or prompt if ambiguous.

### Phase 1 — Detect web vs code

If `--no-web`: code mode. If `--web`: web mode. Otherwise heuristic: glob the diff for web surfaces (`.tsx`, `.jsx`, `.vue`, `.svelte`, `app/**/*.ts`, `pages/**`, `components/**`). If found, web mode; else code mode.

### Phase 2 — Tests + verification

Invoke `orc:verification-before-completion`. Run the project's test suite. Run lint and type-check if available. Confirm green output. If anything fails, stop and surface — QA cannot pass.

In workspace mode, run all three checks **per target repo**, in parallel where possible (each repo has its own toolchain). Aggregate results into one verdict: any single repo's failure stops QA — surface which repo + which check.

### Phase 3 — Self-review + (optional) security pass

Invoke `orc:caveman-review`. Review the staged or last-commit diff. Surface any findings to the user.

When the diff touches security-sensitive paths (auth, sessions, raw SQL, deserialization, file upload, network egress, dependency surface) — **dispatch `orc-security-reviewer` in parallel** with the self-review. Same auto-detection as `/orc:code-review`. The agent returns a security finding list; merge with caveman findings before surfacing.

If verification (Phase 2) flagged untested branches — dispatch **`orc-test-author`** to write the missing tests. Pass the function/behavior under-tested + the project's test idioms. The agent writes tests, runs the suite, returns a report. Loop back to Phase 2 if new failures surface.

### Phase 4 (web mode only) — Browser QA

Invoke **`orc:browser-qa`** and execute its protocol end-to-end: env attach/provision (step 0), the driver gate (step 1 — `--driver` or a settled `driver` decision skips it), then Driver A (validator dispatch with the acceptance lists and manifest return) or Driver B (Claude-in-Chrome inline with the chrome-mode evidence packet). This command adds nothing to the protocol — the skill is the single source of truth shared with `/orc:flow` Phase 6.

### Phase 5 — Write the verdict

Write `${ORC_STATE_DIR}/<sanitized-branch>/files/qa-verdict.json` (shape per `orc:state-protocol` `references/schema.md`): one `checks[]` row per suite check (tests/lint/type-check), per slice acceptance criterion scored (`kind: "acceptance"`, evidence = the artifact that proves it; un-scoreable → `result: "skipped"`, visibly), and per browser walk. **The `verdict` is computed mechanically — any `fail` → `fail`; else any `partial` → `partial`; else `pass`. Agents never decide it; this file is what ship/flow gates read.** Stamp `headSha` + `generatedAt`.

Also append the human-readable block to `.orc/<branch>/files/progress.md`:
```
## QA — <ISO-timestamp>
- Tests: pass/fail
- Lint: pass/fail
- Type-check: pass/fail
- Self-review findings: <count>
- Env: <ready (reused) | ready (booted <N>s) | fallback (host) | skipped>
- Browser QA: <pass|fail|partial|skipped (code-only)>
- Artifact dir: .orc/<branch>/files/qa/  (if web mode)
```

Mark QA complete: `orc-state phase set <n> --label qa-complete` + `orc-state digest write -` (per `orc:state-protocol`).

### Phase 6 — Publish evidence (web mode, optional)

When Phase 4 produced a packet, invoke `orc:evidence-publish` — pass `qaDir = ${ORC_STATE_DIR}/<sanitized-branch>/files/qa/`, the browser-QA `verdict`, and (if the session has one) its bound `jiraTicket`. The skill detects tracker enablement, curates the visual proof, and **asks** whether to upload the evidence to the ticket or keep it local, recording the outcome in `steps.md`. No tracker bound / not authed ⇒ it degrades to a one-line "kept local" note — so this is safe to always run in web mode. Skip entirely for code-only QA (no packet to deliver).

## Iron rule

For any web-mode QA, the `qa/` directory MUST contain the driver's full packet:

| Artifact | Driver A — agent-browser | Driver B — chrome |
|----------|--------------------------|-------------------|
| Visual proof | `screenshot-NN-<step>.png` per golden-path step (`--annotate`) + edge-case shots | `qa-<branch>.gif` recording (edge cases included, or an explicit "no edge cases applicable, here's why" note in `steps.md`) |
| A11y snapshot | `snapshot-final.txt` (`agent-browser snapshot`) | `snapshot-final.txt` (`read_page` output) |
| Console | `console.log` (`agent-browser console`) | `console.log` (`read_console_messages`; state any filter used) |
| Network | `network.har` (`agent-browser network har stop`) | `network-summary.md` (distilled `read_network_requests`) |
| Narrative | `steps.md` | `steps.md` (same template) |

Optional bonus evidence (NOT required): `trace.json` (Chrome DevTools trace), `react-renders.json`, `vitals.json`, an OS-recorded `video.mov`. Add these only when relevant to the change.

The chrome driver trades HAR-grade network capture and request mocking for live visibility — that's the user's call at the gate, not a loophole: its packet above is still mandatory in full.

If any required artifact is missing, surface it and stop — the user must address the gap before any "ready to PR" claim:

```markdown
> **🛑 Blocked — QA evidence incomplete**
>
> Missing: <artifact list>. No "QA passed" claim without the full evidence packet.
```

## Output

- `.orc/<branch>/files/qa/...` (web mode)
- `.orc/<branch>/files/progress.md` (appended)
- Ticket delivery outcome recorded in `steps.md` (web mode, via `orc:evidence-publish`)
- Verdict echoed to the user
