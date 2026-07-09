---
description: Pre-PR quality gate — browser-driven QA for web changes (screenshots, a11y snapshot, console, HAR, narrative) via agent-browser, against a Docker-provisioned environment. No QA-passed claim without artifacts. Workspace-aware. For a quick behavioral check without the evidence packet, prefer the bundled /verify or /run.
argument-hint: "[--web <url>] [--no-web] [--no-env] [--repos a,b | --repo a | --all-repos | --this-repo] <feature description>"
allowed-tools:
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
---

# /orc:qa

Run a quality gate before opening a PR. Two modes:

- **Code/CLI/library change** — run tests, lint, type-check; verify with `orc:verification-before-completion`; do a self-review with `orc:caveman-review`. No browser.
- **Web change** — same as above PLUS browser-driven QA via `orc:agent-browser` and the `orc-qa-validator` agent. Evidence is saved to `.orc/<branch>/files/qa/`.

## Arguments

- `--web <url>` — explicit URL of a running app (skips env provisioning AND the validator's boot path — you're saying it's already up).
- `--no-web` — force code-only mode even if web files were touched.
- `--no-env` — skip Docker env provisioning; the validator falls back to its legacy dev-script boot.
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

0. **Provision or attach the environment** (skip when `--web <url>` or `--no-env`). Check `orc-docker-env is-ready $(orc-docker-env state-path "$ORC_STATE_DIR" <sanitized-branch>)`:
   - `ready` → attach; echo the reuse line (project, appUrl, "reused").
   - otherwise → dispatch **`orc-env-provisioner`** via `Task` (repoPath = the worktree; workspace mode adds `repos[]`, `webSurfaceRepo`, plan path). On `fallback`: re-print the agent's ⚠️ callout and continue. On `failed`: re-print the 🛑 callout and `AskUserQuestion` — retry / retry `--fresh` / continue with `--no-env` legacy boot / abort QA.

   The environment **stays up after QA** — the "QA partial → fix → re-run" loop attaches in seconds. Teardown belongs to `/orc:cleanup`.
1. Init `${ORC_STATE_DIR}/<sanitized-branch>/files/qa/` directory. In workspace mode, the cross-repo QA evidence (e.g. ui+api integration walks) goes here; per-repo QA stays at `<repoPath>/.orc/<branch>/files/qa/`.
2. Dispatch the `orc-qa-validator` subagent via `Task`. Pass:
   - The feature description.
   - **`appUrl` + `serviceEndpoints` + `envStatePath`** from `docker-env-state.json` (the validator NEVER boots infra when env state exists — it attaches). Only when step 0 was skipped: the `--web` URL, or legacy boot instructions under `--no-env`.
   - The artifact directory.
   - **Workspace mode only**: `repo` (the web-surface repo from Phase 0), `repoPath`, `siblingRepos` (already running via the provisioned environment — verify their traffic through `serviceEndpoints` in the HAR; the agent does NOT touch them), and `crossRepoContract` (when present in the plan — the agent walks an integration golden path that exercises the contract end-to-end).
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
- Env: <ready (reused) | ready (booted <N>s) | fallback (host) | skipped>
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

If any required artifact is missing, surface it and stop — the user must address the gap before any "ready to PR" claim:

```markdown
> [!CAUTION]
> **🛑 Blocked — QA evidence incomplete**
>
> Missing: <artifact list>. No "QA passed" claim without the full evidence packet.
```

## Output

- `.orc/<branch>/files/qa/...` (web mode)
- `.orc/<branch>/files/progress.md` (appended)
- Verdict echoed to the user
