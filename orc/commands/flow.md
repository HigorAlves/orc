---
description: End-to-end feature/bug/refactor pipeline (plan → start → implement → QA → ship → address → cleanup) with an interactive gate at every phase. Resumable via /orc:resume. --jira <KEY> links a ticket. Workspace-aware.
argument-hint: "[--type=feature|bug|refactor|docs] [--rfc] [--caveman] [--pause-at-implement] [--jira <KEY>] [--max-loc <N>] [--no-size-gate] [--repos a,b | --repo a | --all-repos | --this-repo] <one-line task description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(git *)
  - Bash(gh *:*)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(go *:*)
  - Bash(cargo *:*)
  - Bash(pytest *:*)
  - Bash(curl:*)
  - Bash(node:*)
  - Bash(date:*)
  - Bash(agent-browser:*)
  - Bash(acli *)
  - Bash(jq *)
  - Bash(. */lib/workspace-detect.sh*)
  - Bash(. */lib/pr-size-budget.sh*)
---

# /orc:flow

Drive a piece of work from "I want to do X" to "PR merged, workspace cleaned up." `/orc:flow` is the umbrella — it walks the same phases the individual commands do, but with unified state, interactive gates between phases, and a single resume entry point.

This command is interactive by design. Every phase ends with an `AskUserQuestion` select-from-list — you choose advance, iterate, skip, or abort. **Never silently advances past a gate.**

Immediately before each phase's `AskUserQuestion`, print a one-line Gate callout (per the `orc:insights` palette; `[!WARNING]` instead of `[!NOTE]` when the gate fired because something is wrong):

```markdown
> [!NOTE]
> **⛔ Gate — <phase name>**
>
> [1–2 lines: what was produced, what's being decided]
```

Options never go inside the callout — the question widget renders them natively.

## When to use

Use `/orc:flow` when you want orc to drive the whole loop. Skip it (use the per-phase commands directly: `/orc:plan`, `/orc:debug`, `/orc:qa`, `/orc:ship`, etc.) when you want fine-grained control over a single phase, or when the work clearly fits a single command.

## Arguments

- `<task description>` — required. One sentence describing the work.
- `--type=feature|bug|refactor|docs` — optional. If omitted, the first phase asks via `AskUserQuestion`. The type changes which phases run and which skills get invoked.
- `--rfc` — for `--type=feature` or `--type=refactor`: insert an RFC phase before planning. Required when the work is multi-week, multi-team, or has genuine alternatives.
- `--caveman` — pass through to `/orc:ship` and `/orc:address` so PR bodies and replies use the terse style.
- `--pause-at-implement` — pause Phase 5 for the human to write the implementation manually. Default behavior is autonomous: dispatches `orc-implementer` to drive the implementation slice-by-slice. Use `--pause-at-implement` when you want to write the code yourself.
- `--jira <KEY>` — link a Jira ticket key (e.g. `JRA-123`) to this flow's session silently. Suppresses the Phase 1 link prompt. The key follows the work through every phase, surfaces in `/orc:status`, and lands as `Resolves <KEY>` in the Phase 7 PR body. Validate against `^[A-Z][A-Z0-9_]*-\d+$`.
- `--max-loc <N>` — pass-through to `/orc:ship`'s Phase 4.5 size gate (default: 300, configurable via `$ORC_PR_LOC_BUDGET` or `<repo>/.orc/pr-budget.json`). Phase 7 also pre-flights the gate with one extra option ("Stack from plan slices") that single-repo `/orc:ship` doesn't have.
- `--no-size-gate` — pass-through to `/orc:ship`. Skips both the Phase 7 pre-flight and `/orc:ship`'s gate. Use sparingly.
- `--repos <list>` — workspace mode: comma-separated repo names to target (e.g. `--repos api,ui`). Mutually exclusive with `--repo`, `--all-repos`, `--this-repo`.
- `--repo <name>` — workspace mode: target one repo. Mutually exclusive with `--repos`.
- `--all-repos` — workspace mode: skip the Phase 1 repo prompt and broadcast to every detected repo.
- `--this-repo` — workspace mode: pin to cwd's repo (escape hatch from workspace prompts when cwd is inside one of the workspace's children).

## Phases

The pipeline is **9 phases**, all gated. Some phases are skipped based on type and flags:

| # | Phase | Always? | Skips when … |
|---|-------|---------|--------------|
| 1 | Triage — confirm type and scope | yes | — |
| 2 | RFC — pre-implementation design (`/orc:rfc`) | optional | `--rfc` not passed and not flagged in triage |
| 3 | Plan — TDD-shaped plan (`/orc:plan` logic + skill) | yes | type=docs uses `/orc:scaffold` instead |
| 4 | Start — worktree + failing test (`/orc:start` logic) | for code | type=docs skips |
| 5 | Implement — RETURN TO CONVERSATION; orc pauses | for code | type=docs writes the docs in conversation directly |
| 6 | QA — pre-PR quality gate (`/orc:qa` logic + skill) | yes | type=docs runs lint only |
| 7 | Ship — open the PR (`/orc:ship` logic + caveman-pr if flagged) | yes | — |
| 8 | Address — if reviewer comments arrive (`/orc:address` logic) | optional loop | no comments → skip |
| 9 | Cleanup — post-merge (`/orc:cleanup` logic) | yes | — |

For `--type=bug`, phases 2–3 collapse into a single `/orc:debug` invocation that produces the diagnosis, regression test, and plan all at once.

## Workflow

### Phase 0 — Detect context

Before Triage, source the helper to know whether we're in workspace mode:

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

- `ORC_CONTEXT=repo` → standard single-repo flow. Skip workspace-only steps below.
- `ORC_CONTEXT=workspace` → workspace flow. The state dir is `$ORC_STATE_DIR` (`<workspaceRoot>/.orc`); per-repo state dirs are `<workspaceRoot>/<repo>/.orc/`.
- `ORC_CONTEXT=loose` → surface and stop:

  ```markdown
  > [!WARNING]
  > **⚠️ Caution**
  >
  > Cwd is neither a git repo nor a workspace parent — cannot run /orc:flow here.
  ```

### Phase 1 — Triage

If the user provided a long-form PRD, a Jira/issue link, or a multi-paragraph brief — dispatch `orc-prd-analyzer` via `Task` first. The agent returns a structured analysis (goals, ambiguities, P0/P1/P2 clarifying questions). Use its recommendation to gate progression: if P0 questions exist, surface them and ask the user to either answer here or pause the flow until they're resolved with the PM.

If the input is a short one-liner ("add CSV export"), skip the analyzer and proceed.

Determine the **type** of work if `--type=` wasn't passed:

```
AskUserQuestion: What kind of work?
- feature       — new capability, plan + start + ship loop
- bug           — root-cause investigation, then fix with TDD
- refactor      — restructuring without changing behavior
- docs          — README, architecture, ADR/RFC, Diátaxis quadrants
- something else / let me describe — opens free-form follow-up
```

Determine **scope:**

```
AskUserQuestion: Scope?
- < 1 day        — small; skip RFC, simple plan
- 1–5 days       — medium; full plan, optional grill-me
- 1–4 weeks      — big; suggest --rfc; offers /orc:rfc next
- multi-quarter  — too big for /orc:flow; suggests breaking down with /orc:plan --issues first
```

**Resolve repo selection (workspace mode only).** When `ORC_CONTEXT=workspace` and the user did not pass `--repos`, `--repo`, `--all-repos`, or `--this-repo`:

```
AskUserQuestion: This is a workspace with N repos: <list from $ORC_WORKSPACE_REPOS>. Scope this flow to which repos?
- All N detected repos
- Pick a subset (multi-select follow-up)
- Just this repo (cwd) — only when cwd is inside a workspace child
- Cancel
```

Record the resolved set as `targetRepos` in `checkpoint.md`. When the resolved set has exactly one repo and the user is inside that repo via `--this-repo`, treat the rest of the flow as a single-repo flow against that `repoPath` (no workspace state).

**Iron rule (no silent broadcast):** workspace mode never proceeds past Triage without an explicit repo set.

**Resolve the Jira link.** Before initializing workspace state:

- If `--jira <KEY>` was passed, validate against `^[A-Z][A-Z0-9_]*-\d+$`. Reject and stop on mismatch.
- Otherwise, ask via `AskUserQuestion` — *"Link a Jira ticket to this flow?"* with options:
  - `Paste a key` (then prompt for the key, validate the same way)
  - `Skip — I'll bind later via /orc:jira bind`
  - `No ticket — this work has no tracker entry`

Initialize `${ORC_STATE_DIR}/<sanitized-branch>/files/` and write `checkpoint.md` (phase=1, command=flow, total_phases=9 — adjust for skipped phases). Add `jiraTicket: <KEY>` to the frontmatter when set. Append entry to `${ORC_STATE_DIR}/orc.json` with `command: "flow"`, `jiraTicket: <KEY>` (omit field if null), and — in workspace mode — `scope: "workspace"`, `repos: targetRepos`, `perRepoState: { <repo>: { repoPath, currentSlice: 0, prUrl: null } }`.

In workspace mode, also seed each target repo's `<workspaceRoot>/<repo>/.orc/<sanitized-branch>/workspace-link.json`:

```json
{ "scope": "workspace-member", "workspaceRoot": "<absolute path>", "workspaceName": "<name>", "sessionId": "<id>", "branch": "<branch>" }
```

This is the back-pointer `/orc:status` and `/orc:resume` follow when the user `cd`s into one repo.

### Phase 2 — RFC (optional)

If triage flagged "1–4 weeks" or `--rfc` was passed, invoke the RFC sub-flow (same logic as `/orc:rfc`). Saves to `.orc/<branch>/files/rfc-NNNN.md` workspace draft, optionally commits to `docs/rfcs/NNNN-*.md`.

```
AskUserQuestion (after RFC drafted):
- RFC looks good — proceed to plan
- Iterate on RFC — loop back
- Pause here — RFC is the deliverable for now (mark flow as completed)
- Abort the whole flow
```

### Phase 3 — Plan

For `--type=feature|refactor`: invoke `orc:writing-plans`, optionally `orc:grill-me` if scope ≥ medium. Saves `${ORC_STATE_DIR}/<branch>/files/plan.md`.

In workspace mode, the plan template MUST include:

1. A **Repo touchpoints** section listing each target repo and what changes there (e.g. `api: new POST /export endpoint`, `ui: download button + progress state`).
2. A **Cross-repo contract** section (when applicable) describing the API/wire-format shape both repos must respect — endpoint paths, schemas, message types. This contract is frozen during Phase 5.
3. A **Merge order** line (e.g. `api → ui`) when there's a deploy ordering dependency. Omit if either order works.
4. Each slice tagged with `repo: <name>` so the Phase 5 dispatcher knows which implementer instance owns it.

For `--type=docs`: invoke `/orc:scaffold` if greenfield, or `orc:documentation-writer` if augmenting existing.

For `--type=bug`: this phase becomes `/orc:debug` instead — dispatches `orc-debug-investigator` to produce `diagnosis.md`. Treat the diagnosis as the plan.

```
AskUserQuestion (after plan drafted):
- Plan looks good — proceed
- Iterate — loop back
- Add --grill stress-test pass
- Decompose into issues (orc:to-issues) — for big plans
- Abort
```

### Phase 4 — Start

For code work (`feature`, `bug`, `refactor`): invoke `orc:using-git-worktrees` (worktree + branch), then write the first failing test.

In workspace mode, repeat the worktree+branch step for every repo in `targetRepos`. Worktrees live at `${ORC_WORKSPACE_ROOT}/.orc/.worktrees/<repo>/<sanitized-branch>/`. Run the **branch-collision check** for every target repo before creating worktrees:

```bash
for r in $targetRepos; do
  git -C "$ORC_WORKSPACE_ROOT/$r" show-ref --verify --quiet "refs/heads/<branch>"
done
```

| Repo state | Action |
|------------|--------|
| Branch absent locally and on origin | OK — create. |
| Branch absent locally, present on origin | OK — `git fetch && git worktree add -B`. |
| Branch present, points at base HEAD | OK — adopt. |
| Branch present, has divergent commits | **Conflict** — `AskUserQuestion` with the 5 recovery options below. |

Recovery options on conflict (one prompt covering all conflicting repos at once):

1. Suffix all repos with `-2` (or user-chosen short suffix).
2. Suffix only conflicting repos (e.g. `feat/sso-login-api`); keep canonical name elsewhere.
3. Adopt the existing branch (surface divergent commits in the plan-confirmation gate).
4. Pick a different canonical name (restart this step).
5. Abort the flow.

Record any suffix overrides in `checkpoint.md` and `perRepoState[<repo>].branch` so `/orc:resume` and `/orc:ship` know the actual branch per repo.

Then write the first failing test in whichever repo it naturally lives in (per the plan's slice-1 `repo:` tag):

- **Simple first test** (single assertion, single function under test): invoke `orc:tdd` skill inline.
- **Complex first test** (state machine, async coordination, integration boundary, multiple branches): dispatch `orc-test-author` via `Task`. The agent designs a comprehensive suite (happy path + boundary + error paths) using the project's test idioms, runs it, reports.

Test MUST fail with the right message. Commit the failing test in its target repo.

For `--type=docs`: skip; advance to phase 6.

```
AskUserQuestion (after failing test committed):
- Test fails as expected — ready to implement
- Test failure isn't right — iterate
- Skip TDD for this work (with rationale; logged to checkpoint)
- Abort
```

### Phase 5 — Implement (autonomous by default)

Two modes, picked by the `--pause-at-implement` flag:

#### Default: dispatch `orc-implementer` (autonomous)

Read the plan and group slices into **dispatch batches**.

**Workspace mode pre-step:** group slices by their `repo:` tag first. Each repo group gets its own implementer dispatch chain. Repo groups run in parallel with each other (one implementer per repo, simultaneously). Within each repo group, the existing sequential/parallel-batch logic applies. The outer loop is `for repo in targetRepos: dispatch implementer(s)`. Each implementer receives `repo`, `repoPath: <workspaceRoot>/<repo>` (or its worktree path), `siblingRepos: [<other targets>]`, and (when present) `crossRepoContract: <plan section pointer>`. **Sibling implementers must not touch each other's files** — the worktree path boundary already guarantees this.

After grouping by repo, for each repo's slices:

- A **sequential batch** is one slice that can't run in parallel with others (depends on a prior slice's output, or shares files with siblings). Run as a single implementer dispatch with that one slice.
- A **parallel batch** is N slices marked parallel-safe in the plan AND with disjoint file ownership. Dispatch N implementer instances **in parallel** (single response, multiple `Task` calls), each receiving a 1-slice list and `mode: parallel` so they return diffs instead of committing.

Iterate batches in plan order. After each batch:
- Sequential: implementer already committed; advance.
- Parallel: collect all returned diffs + test reports, apply them in plan order via `orc:git-commit` (one commit per slice, in order), run the full suite once after all diffs are applied to confirm green.

Each implementer instance gets:
- The plan path (`${ORC_STATE_DIR}/<branch>/files/plan.md`) or diagnosis path for bugs.
- The workspace directory (per-repo `.orc/<branch>/files/` for `progress.md` writes; in workspace mode also the workspace-level `<workspaceRoot>/.orc/<branch>/files/`).
- The current branch + worktree path.
- Its assigned slice list (1 slice in parallel mode, N in sequential).
- The file-ownership boundary for those slices.
- The failing test from Phase 4 (if slice 1 is in the list).
- Project test/lint/type-check commands (auto-detected from `package.json`, `Makefile`, etc.).
- Mode flag: `mode: sequential` (default) or `mode: parallel` (for parallel-batch members).
- **Workspace mode only**: `repo`, `repoPath`, `siblingRepos`, optional `crossRepoContract`. The slice list is pre-filtered to slices tagged `repo: <name>`.

The agent then drives its assigned slice(s): read spec → write/confirm failing test → implement → run test green → run full suite → lint/type-check → refactor → commit (sequential) or return diff (parallel) → bump checkpoint → next slice in its list.

The agent runs without further user gates UNLESS one of the **escalation conditions** triggers (see `agents/orc-implementer.md`):

- A test can't be made green after 3 attempts.
- A slice spec is ambiguous (multiple valid implementations).
- A new dependency needs to be installed.
- The slice requires touching files outside its declared scope.
- A pre-existing test breaks unexpectedly.
- A security/architecture concern surfaces mid-implementation.
- The plan is wrong (the slice as written would produce incorrect behavior).

When the agent escalates, re-print BOTH blocks it emitted verbatim — the `[!CAUTION]` **🛑 Escalation** callout AND its context fence (file:line evidence + the option definitions; see `agents/orc-implementer.md`) — then `AskUserQuestion`:

```
A. <option A from agent>
B. <option B from agent>
C. Pause flow — I'll come back to /orc:flow
```

User picks → re-dispatch the agent with the resolution, or pause the flow.

When the agent reports all slices complete, advance to Phase 6 (QA) automatically — no extra gate needed (you can pre-approve advance via the agent's status echo, or the umbrella's Phase 6 will gate before running QA anyway).

#### Opt-out: `--pause-at-implement` (human writes the code)

If the flag is passed, fall back to the original behavior:

```
checkpoint.md → phase=5, status=ready-for-implementation, last_artifact=<test-file>:<line>
progress.md → "Implementation phase started. Run /orc:flow again (or /orc:resume) when ready for QA."
```

Echo to the user — the handoff callout (a `[!TIP]`, not a Gate: flow exits here, no question follows), then the details in a fence:

```markdown
> [!TIP]
> **➡️ Next**
>
> orc paused (`--pause-at-implement`). Re-run `/orc:flow` (or `/orc:resume`) when you're done implementing and flow picks up at QA.
```

```
Worktree:     <path>
Failing test: <file>:<line>
Plan:         .orc/<branch>/files/plan.md
```

Remind: the PreToolUse hook keeps you off main — commit per slice (Conventional Commits via `orc:git-commit`).

The next invocation of `/orc:flow` (or `/orc:resume`) reads the checkpoint and jumps to phase 6.

### Phase 6 — QA

Detect web vs code mode (heuristic on changed files vs main). Invoke `orc:verification-before-completion` (tests + lint + type-check) and `orc:caveman-review` (self-review of diff).

When the diff touches security-sensitive paths (auth, sessions, raw SQL, deserialization, file upload, network egress, dependency surface) — dispatch `orc-security-reviewer` in parallel with the self-review. Merge findings before surfacing.

For web changes, dispatch `orc-qa-validator` (drives `agent-browser`, captures evidence to `.orc/<branch>/files/qa/`). In workspace mode, the validator picks the repo declared as the web surface in the plan's "Repo touchpoints" section (`repoPath = <workspaceRoot>/<that repo>`); cross-repo integration evidence (e.g. ui+api walks) lands at the workspace-level `<workspaceRoot>/.orc/<branch>/files/qa/`, repo-local QA stays per-repo.

If verification flags untested branches, dispatch `orc-test-author` to fill them in before continuing.

```
AskUserQuestion (after QA verdict):
- QA passed — proceed to ship
- QA partial — let me address findings, then re-run QA
- QA failed — back to implement
- Skip web QA (with rationale, logged) — only when --no-web justified
- Abort
```

### Phase 7 — Ship

Pre-flight the **size gate** before invoking `/orc:ship`. Defer to `orc:pr-size-budget` for canonical mechanics. Skip when `--no-size-gate` is set.

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/pr-size-budget.sh"
# In workspace mode, iterate per target repo; in single-repo, run once.
```

For each target repo, compute `loc = orc_pr_loc <base>` and `budget = orc_pr_budget "$ARG_MAX_LOC"`. If `loc > budget`, render the gate exactly as `orc:pr-size-budget` specifies (the `[!WARNING]` **⛔ Gate — PR size** callout — in workspace mode add `(repo: <r>)` to the header — then the fenced breakdown), and surface a **flow-enriched 4-option** `AskUserQuestion` (the standalone `/orc:ship` gate has only the first three — Phase 7 adds option A because the flow knows the plan):

```
A. Stack from plan slices (Recommended, flow-only)
   Use the existing per-slice commits as the stack scaffold. One PR per Phase 5 batch.
   (Only enabled when commits map 1:1 to plan slices.)
B. Stack via /orc:stack-pr [--smart]
   Standalone analyzer; same outcome as A but doesn't rely on commit/slice alignment.
C. Open as one big PR — requires a one-line reason (Size-budget-override: trailer).
D. Abort to implement — go back, resize, re-run /orc:flow.
```

A is enabled iff `n_commits_on_branch == n_slices_in_plan` AND each commit subject contains the slice name (best-effort match). When the heuristic fails, hide A and present B/C/D only.

Per-repo decisions are independent: in workspace mode, repo `api` can pick A while `ui` picks C. Record each decision in `checkpoint.md` (so `/orc:resume` knows we already gated this repo).

Then invoke `/orc:ship` logic with the gate decision pre-applied (pass `--no-size-gate` to ship to avoid re-prompting):

- `orc:requesting-code-review` (gap check vs the plan)
- `orc:finishing-a-development-branch` (presents structured options)
- `orc:git-commit` (if uncommitted)
- PR composition: caveman-pr if `--caveman` was passed, otherwise the verbose template
- `gh pr create` — UNLESS this repo picked A or B above, in which case `/orc:stack-pr` already opened the PRs and Phase 7 only records the stack metadata in `linkedPRs`.

In workspace mode, `/orc:ship` opens **N PRs** — one per target repo — and second-passes each with `gh pr edit` to inject a "Linked PRs" cross-link block + merge order from the plan. Captured PR URLs are written into the workspace registry's `linkedPRs` array (with `stackId`/`stackPosition`/`stackedOn` populated for repos that stacked).

```
AskUserQuestion (after PR composed):
- Open as-is
- Edit title/body first
- Open as draft
- Cancel
```

### Phase 8 — Address (loop, optional)

After the PR is open, orc would normally exit. But `/orc:flow` offers a stay-resident option:

```
AskUserQuestion:
- Wait for reviewer comments — orc keeps the flow open; re-invoke /orc:flow once comments arrive and orc routes to address
- I'll come back later with /orc:address — flow advances to cleanup readiness
- Done — flow exits at this phase (cleanup deferred)
```

If user picks "Wait" and comes back: dispatch `/orc:address` logic in parallel — `orc-code-fixer` + `orc-reply-drafter`. After the address loop completes, optionally loop again if more comments arrive, or advance.

### Phase 9 — Cleanup (post-merge)

After merge in GitHub, the user re-invokes `/orc:flow` and orc detects `gh pr view <ref> --json state` returns `merged`. Then run `/orc:cleanup` logic for this session:

- Remove `.orc/<branch>/`
- Remove worktree (if clean)
- Remove local branch (if merged)
- Update central registry

In workspace mode, cleanup runs only when **every** PR in `linkedPRs` is merged (use `gh pr view` per URL). When some are merged and others are still open, surface that list and `AskUserQuestion`: wait, clean per-repo (using `--per-repo`), or abort. After all merge, clean each repo's worktree + per-repo `.orc/<branch>/` AND the workspace-level `<workspaceRoot>/.orc/<branch>/` together.

```
AskUserQuestion (preview the cleanup plan):
- Apply as shown
- Edit (skip individual items)
- Skip cleanup — keep state for now
- Abort cleanup
```

After cleanup: mark `.orc/orc.json` entry `status: completed`, echo a summary.

## Resume

If interrupted at any phase, `/orc:resume` reads `.orc/<branch>/files/checkpoint.md` and re-enters at the next pending phase. Or just re-run `/orc:flow` — the command itself reads the checkpoint and jumps forward.

This means a typical workday looks like:

```
Monday morning:    /orc:flow "add CSV export to reports"
                   → triage, RFC skipped (small scope), plan, start
                   → orc pauses at phase 5

Monday afternoon:  (user implements, commits per slice)

Tuesday morning:   /orc:flow  (no args; reads checkpoint, picks up at QA)
                   → QA, ship
                   → orc pauses at phase 8 ("waiting for review")

Tuesday afternoon: reviewers comment
                   /orc:flow  (reads checkpoint, routes to address)
                   → address loop

Wednesday: PR merges
                   /orc:flow  (reads checkpoint, runs cleanup)
                   → cleanup
                   → flow done
```

## Iron rules in play

- **Every gate is a real gate.** No phase silently advances past `AskUserQuestion`. The user can always abort, iterate, or skip.
- **Phase state is durable.** `.orc/<branch>/files/checkpoint.md` updates after every phase. Crash-resumable.
- **Per-phase rules still apply.** The web QA evidence rule, blameless postmortem framing (in /orc:flow type=bug for incident-driven debugging), no-AI-attribution, no-commits-to-main — all still enforced. /orc:flow doesn't relax any of them.
- **/orc:flow is opt-in.** All the per-phase commands continue to work standalone for users who want fine-grained control.

## Output (per phase)

Each phase echoes a one-line status, the artifact it produced, and the next-step handoff. The handoff is the user's choice via AskUserQuestion — never assumed.

After the entire flow:

```
✓ Flow complete: feat-csv-export
  - plan.md        (TDD-shaped, 4 slices)
  - first-test     (failing → green over the course of implementation)
  - qa/            (4 screenshots, console.log, network.har, steps.md)
  - PR             (#311, merged 2026-05-03)
  - cleanup        (worktree removed, branch deleted, .orc/ cleared)

Total active time: ~2 days (paused 14h overnight Mon→Tue)
Active orc sessions remaining: 0
```

Close with one `[!TIP]` handoff when anything remains for the user (skip it when the summary already says "0 sessions remaining" and nothing is pending):

```markdown
> [!TIP]
> **➡️ Next**
>
> [the single most useful next command, e.g. `/orc:status` or `/orc:resume`]
```
