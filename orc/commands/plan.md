---
description: Plan a feature or refactor — produces a TDD-shaped plan, optionally design-grilled, and decomposes it into independently shippable issues. --jira <KEY> links a ticket. Workspace-aware.
argument-hint: "[--grill] [--issues] [--jira <KEY>] [--repos a,b | --repo a | --all-repos | --this-repo] <feature description>"
effort: high
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(date:*)
  - Bash(git rev-parse:*)
  - Bash(git branch --show-current:*)
  - Bash(jq:*)
  - Bash(graphify:*)
  - Bash(orc-workspace-detect:*)
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

After the analyzer returns, print the Gate headline (`**⛔ Gate — PRD analysis**`, one line on P0/P1/P2 counts, per `orc:callouts`), then `AskUserQuestion`:
- "Proceed to plan — questions are P1/P2 only"
- "Hold — answer P0 questions with PM first" (exit; don't waste planning effort)
- "Run `/orc:rfc` first — design space needs RFC treatment"

If the input is short and clear, skip Phase 0 and go straight to Phase 1.

### Phase 0b — Detect refactor-shaped input (optional)

If the request is refactor-shaped — the user asks to refactor, restructure, pay down tech debt, or improve architecture, or `--type=refactor` was forwarded (e.g. from `/orc:flow`) — dispatch the `orc-refactor-architect` subagent via `Task` first. Pass it the request plus any named modules/paths. The agent compares documented intent (ADRs, `CONTEXT.md`) against the implementation and returns leverage-ranked refactor candidates with cost-vs-friction estimates.

After the architect returns, print the Gate headline (`**⛔ Gate — refactor candidates**`, one line on candidate count + top leverage pick, per `orc:callouts`), then `AskUserQuestion` listing the ranked candidates (plus "Different scope — describe it"). The chosen candidate becomes the scope Phase 2 drafts the plan around.

Phase 0 and 0b are exclusive — input is brief-shaped or refactor-shaped, not both. If neither fits, go straight to Phase 1.

### Phase 1 — Initialize workspace

0. **Detect context** — injected below (`ORC_*` vars are exported for any Bash you run — do not re-run detection):

   !`orc-workspace-detect --banner`

   In workspace mode, resolve `targetRepos` from `--repos`/`--repo`/`--all-repos`/`--this-repo` or via `AskUserQuestion` (same prompt shape as `/orc:flow` Phase 1). Iron rule: no silent broadcast.
1. Determine the current branch: in repo mode `git branch --show-current`; in workspace mode prompt the user for the branch name (no cwd repo to read from), or accept it from a parent flow's checkpoint when called from `/orc:flow`.
2. Sanitize: `feat/142-foo` → `feat-142-foo`.
3. Create `${ORC_STATE_DIR}/<sanitized-branch>/files/` if it doesn't exist. In workspace mode, also create `<workspaceRoot>/<repo>/.orc/<sanitized-branch>/` per target repo with a `workspace-link.json` back-pointer.
4. **Resolve the Jira link.**
   - If `--jira <KEY>` was passed: validate against `^[A-Z][A-Z0-9_]*-\d+$`. Reject and stop on mismatch.
   - Else if the key is a settled decision (`orc-state decision get jiraTicket` — a parent flow/start already resolved it) or the tracker layer declares no Jira (`orc:tracker-config` — record `jiraTicket=none` inferred): use it silently, echo the settled-decision line, don't ask.
   - Otherwise: ask via `AskUserQuestion` — *"Link a Jira ticket to this session?"* with options:
     - `Paste a key` (then prompt for the key, validate the same way)
     - `Skip — I'll bind later via /orc:jira bind`
     - `No ticket — this work has no tracker entry`
   - When a key is resolved, set `JIRA_TICKET=<KEY>`. Otherwise leave `JIRA_TICKET=null`.
5. Register state: `orc-state init --command plan --total-phases 4 [--jira <KEY>]` (5 with `--issues`, 6 with `--grill --issues`; workspace mode adds `--scope workspace --repos <targetRepos>`). Defer to `orc:state-protocol` for schema and rules.
6. Write `checkpoint.md` with frontmatter including `jiraTicket: <KEY>` if set, and (workspace mode) `repos: [<list>]`.

### Phase 1b — Prime code discovery (optional, non-blocking)

Follow `orc:code-discovery`: if `graphify` is installed, ensure a fresh code graph exists before drafting — build it if missing (`graphify extract . --code-only`, local AST, no key, seconds) or refresh it if `graph.json`'s `built_at_commit` differs from the current branch (`graphify update .`). This lets Phase 2 (`orc:writing-plans`) and any dispatched `orc-prd-analyzer` map file touchpoints and blast-radius by query instead of grepping the tree. Add `graphify-out/` to `.git/info/exclude`. In workspace mode, prime one per target repo. If `graphify` is absent or the build fails, skip silently — planning falls back to Glob/Grep and is unaffected.

### Phase 2 — Draft the plan

Invoke `orc:writing-plans`. Follow that skill exactly. Write the output to `${ORC_STATE_DIR}/<branch>/files/plan.md`. Update `checkpoint.md` (phase=2, last_artifact=plan.md).

**Per-slice LOC budget contract (all modes)** — every slice MUST carry an `est_loc: <int>` field as part of its header. The estimate is the implementer's **contract**, not a precise prediction:

- Heuristic for the planner: `est_loc ≈ (new_files * 80) + (modified_files * 30) + boilerplate_test_lines`. Adjust for known-large files. When a Graphify graph exists (primed in Phase 1b), sharpen `modified_files` with `graphify affected "<symbol>"` blast-radius per `orc:writing-plans`, and flag high-fan-in changes as `ships_as_stack: true` before implementation.
- If a slice's estimate exceeds `${ORC_PR_LOC_BUDGET:-300}`, **split the slice further** OR mark it `ships_as_stack: true` to signal the implementer should expect to invoke `/orc:stack-pr` at ship time.
- During Phase 5 (implement), if a slice's actual diff exceeds `est_loc * 1.5`, the implementer **escalates** rather than balloons the slice silently. This is enforced by `orc-implementer`'s escalation conditions.

Defer to `orc:pr-size-budget` for the budget resolution order and exclusion list.

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
   - est_loc: 140
   - …
   ```
   The Phase 5 dispatcher reads `repo:` to fan out implementers per repo, and `est_loc:` to enforce the per-slice budget contract.

### Phase 3 (optional, with `--grill`) — Stress-test the design

Invoke `orc:grill-me`. The skill drives an interview that exposes hidden assumptions. Update `plan.md` with answers. Bump `checkpoint.md`.

### Phase 4 — Confirm with user + install the slice ledger

Print the Gate headline (`**⛔ Gate — plan review**`), then `AskUserQuestion` with two options: `Looks good — proceed` / `Iterate — revise plan`. If iterate, return to Phase 2.

On approval, **generate the slice ledger**: parse the approved plan's slice headers (`est_loc`, `repo`, `ships_as_stack`, `touchpoints`, `parallel_group`, `depends_on`, `acceptance` — per `orc:writing-plans`) into a `slices.json` (shape per `orc:state-protocol` `references/schema.md`, every slice `status: "pending"`, `planSha256` = sha of plan.md) and install it: `orc-state slice init <file>`. Consumers (`/orc:flow` Phase 5, `/orc:fan-out`, `orc-implementer`) read the ledger, not the prose; "all slices done" becomes `orc-state slice list --status pending,red,escalated` exiting clean. On plan re-approval after iteration, regenerate — statuses of slices whose `title` still matches are preserved.

### Phase 5 (optional, with `--issues`) — Decompose

Invoke `orc:to-issues` to break the approved plan into vertical-slice issues on the project tracker. Save the issue map to `.orc/<branch>/files/issues.md`. Bump `checkpoint.md` to phase=done.

## Output

- `.orc/<branch>/files/plan.md` — the approved plan
- `.orc/<branch>/files/checkpoint.md` — current phase + status
- (with `--issues`) `.orc/<branch>/files/issues.md`
- Updated `.orc/orc.json` registry entry

## Resume

If interrupted, `/orc:resume` reads the checkpoint and jumps to the next pending phase.
