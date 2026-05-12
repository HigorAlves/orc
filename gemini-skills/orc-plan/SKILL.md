---
name: orc-plan
description: Plan a feature or refactor — produces a TDD-shaped plan, with optional design grilling, and decomposes into independently shippable issues. Writes to .orc/<branch>/files/. Phase 1 always asks to link a Jira ticket (skip-able); --jira <KEY> suppresses the prompt and links silently. Workspace-aware — in workspace mode the plan is written at the workspace level with per-slice repo: tags.
---
# /orc:plan

Turn a feature or refactor request into a written, TDD-shaped implementation plan. Persist it to `.orc/<branch>/files/plan.md` so the work can pause and resume.

## Arguments

- `--grill` — after drafting the plan, invoke `orc:grill-me` to stress-test the design before committing.
- `--issues` — after the plan is approved, run `orc:to-issues` to break it into independently grabbable issues.
- `--jira <KEY>` — link a Jira ticket key (e.g. `PROJ-123`) to this session silently. Suppresses the Phase 1 link prompt. Validate against `^[A-Z][A-Z0-9_]*-\d+$`.
- `--repos <list>`, `--repo <name>`, `--all-repos`, `--this-repo` — workspace-mode repo selection. See `orc:workspace-mode` for precedence.
- The feature description is the rest of the argument string.

## Workflow

### Phase 0 — Detect PRD-shaped input (optional)

If the feature description is long-form, references a Jira ticket / linked doc, or reads more like a brief than a settled spec — dispatch the `orc-prd-analyzer` subagent via `Task` first. Pass it the input + the URL if there is one. The agent returns a structured analysis (extracted goals, ambiguities, P0/P1/P2 clarifying questions, recommendation).

`AskUserQuestion` after the analyzer returns:
- "Proceed to plan — questions are P1/P2 only"
- "Hold — answer P0 questions with PM first" (exit; don't waste planning effort)
- "Run `/orc:rfc` first — design space needs RFC treatment"

If the input is short and clear, skip Phase 0 and go straight to Phase 1.

### Phase 1 — Initialize workspace

0. **Detect context**:
   ```bash
   . "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
   eval "$(orc_detect_context)"
   ```
   In workspace mode, resolve `targetRepos` from `--repos`/`--repo`/`--all-repos`/`--this-repo` or via `AskUserQuestion` (same prompt shape as `/orc:flow` Phase 1). Iron rule: no silent broadcast.
1. Determine the current branch: in repo mode `git branch --show-current`; in workspace mode prompt the user for the branch name (no cwd repo to read from), or accept it from a parent flow's checkpoint when called from `/orc:flow`.
2. Sanitize: `feat/142-foo` → `feat-142-foo`.
3. Create `${ORC_STATE_DIR}/<sanitized-branch>/files/` if it doesn't exist. In workspace mode, also create `<workspaceRoot>/<repo>/.orc/<sanitized-branch>/` per target repo with a `workspace-link.json` back-pointer.
4. **Resolve the Jira link.**
   - If `--jira <KEY>` was passed: validate against `^[A-Z][A-Z0-9_]*-\d+$`. Reject and stop on mismatch.
   - Otherwise: ask via `AskUserQuestion` — *"Link a Jira ticket to this session?"* with options:
     - `Paste a key` (then prompt for the key, validate the same way)
     - `Skip — I'll bind later via /orc:jira bind`
     - `No ticket — this work has no tracker entry`
   - When a key is resolved, set `JIRA_TICKET=<KEY>`. Otherwise leave `JIRA_TICKET=null`.
5. Append/update an entry in `${ORC_STATE_DIR}/orc.json` (registry) with `command: "plan"`, `status: in_progress`, `current_phase: 1`, `total_phases: 4` (or 5 with `--issues`, 6 with `--grill --issues`), and `jiraTicket: <KEY>` (omit field if null). In workspace mode, also set `scope: "workspace"`, `repos: targetRepos`, and `perRepoState` rows.
6. Write `checkpoint.md` with frontmatter including `jiraTicket: <KEY>` if set, and (workspace mode) `repos: [<list>]`.

### Phase 2 — Draft the plan

Invoke `orc:writing-plans`. Follow that skill exactly. Write the output to `${ORC_STATE_DIR}/<branch>/files/plan.md`. Update `checkpoint.md` (phase=2, last_artifact=plan.md).

**Workspace mode plan template additions** — when `targetRepos` has 2+ entries, the plan MUST include:

1. **Repo touchpoints** — a section listing each target repo and the changes it owns:
   ```markdown
   ## Repo touchpoints
   - api: new POST /export endpoint with row-streaming
   - ui:  download button + progress state + error toast
   ```
2. **Cross-repo contract** — when slices span repos, freeze the API/wire-format shape both sides must respect:
   ```markdown
   ## Cross-repo contract
   - HTTP: POST /api/export, body `{ filterId: string }`, returns 202 + Location header
   - Stream: chunked CSV with header row first; ETA in custom `X-Stream-Eta` header
   ```
   This contract is treated as **frozen** during Phase 5 — implementers must not unilaterally change it.
3. **Merge order** (optional) — when there's a deploy dependency:
   ```markdown
   ## Merge order: api → ui
   ```
4. **Per-slice `repo:` tag** — each slice declares which repo owns it:
   ```markdown
   ### Slice 3 — POST /export endpoint
   - repo: api
   - files owned: src/routes/export.ts, test/export.test.ts
   - …
   ```
   The Phase 5 dispatcher reads this tag to fan out implementers per repo.

### Phase 3 (optional, with `--grill`) — Stress-test the design

Invoke `orc:grill-me`. The skill drives an interview that exposes hidden assumptions. Update `plan.md` with answers. Bump `checkpoint.md`.

### Phase 4 — Confirm with user

Use `AskUserQuestion` with two options: `Looks good — proceed` / `Iterate — revise plan`. If iterate, return to Phase 2.

### Phase 5 (optional, with `--issues`) — Decompose

Invoke `orc:to-issues` to break the approved plan into vertical-slice issues on the project tracker. Save the issue map to `.orc/<branch>/files/issues.md`. Bump `checkpoint.md` to phase=done.

## Output

- `.orc/<branch>/files/plan.md` — the approved plan
- `.orc/<branch>/files/checkpoint.md` — current phase + status
- (with `--issues`) `.orc/<branch>/files/issues.md`
- Updated `.orc/orc.json` registry entry

## Resume

If interrupted, `/orc:resume` reads the checkpoint and jumps to the next pending phase.
