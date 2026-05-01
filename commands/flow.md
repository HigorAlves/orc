---
description: End-to-end feature/bug/refactor pipeline with interactive gates at every phase. Walks plan → start → implement → QA → ship → address → cleanup. Resumable from any phase via /orc:resume. Each phase ends with AskUserQuestion (select-from-list) for confirmation, iteration, skip, or abort.
argument-hint: "[--type=feature|bug|refactor|docs] [--rfc] [--caveman] [--pause-at-implement] <one-line task description>"
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
---

# /orc:flow

Drive a piece of work from "I want to do X" to "PR merged, workspace cleaned up." `/orc:flow` is the umbrella — it walks the same phases the individual commands do, but with unified state, interactive gates between phases, and a single resume entry point.

This command is interactive by design. Every phase ends with an `AskUserQuestion` select-from-list — you choose advance, iterate, skip, or abort. **Never silently advances past a gate.**

## When to use

Use `/orc:flow` when you want orc to drive the whole loop. Skip it (use the per-phase commands directly: `/orc:plan`, `/orc:debug`, `/orc:qa`, `/orc:ship`, etc.) when you want fine-grained control over a single phase, or when the work clearly fits a single command.

## Arguments

- `<task description>` — required. One sentence describing the work.
- `--type=feature|bug|refactor|docs` — optional. If omitted, the first phase asks via `AskUserQuestion`. The type changes which phases run and which skills get invoked.
- `--rfc` — for `--type=feature` or `--type=refactor`: insert an RFC phase before planning. Required when the work is multi-week, multi-team, or has genuine alternatives.
- `--caveman` — pass through to `/orc:ship` and `/orc:address` so PR bodies and replies use the terse style.
- `--pause-at-implement` — pause Phase 5 for the human to write the implementation manually. Default behavior is autonomous: dispatches `orc-implementer` to drive the implementation slice-by-slice. Use `--pause-at-implement` when you want to write the code yourself.

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

Initialize `.orc/<sanitized-branch>/files/` and write `checkpoint.md` (phase=1, command=flow, total_phases=9 — adjust for skipped phases). Append entry to `.orc/orc.json` with `command: "flow"`.

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

For `--type=feature|refactor`: invoke `orc:writing-plans`, optionally `orc:grill-me` if scope ≥ medium. Saves `.orc/<branch>/files/plan.md`.

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

- **Simple first test** (single assertion, single function under test): invoke `orc:tdd` skill inline.
- **Complex first test** (state machine, async coordination, integration boundary, multiple branches): dispatch `orc-test-author` via `Task`. The agent designs a comprehensive suite (happy path + boundary + error paths) using the project's test idioms, runs it, reports.

Test MUST fail with the right message. Commit the failing test.

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

`Task` dispatches `orc-implementer` (model: opus) with:
- The plan path (`.orc/<branch>/files/plan.md`) or diagnosis path for bugs.
- The workspace directory.
- The current branch + worktree path.
- The failing test from Phase 4.
- Project test/lint/type-check commands (auto-detected from `package.json`, `Makefile`, etc.).

The agent then drives the loop slice-by-slice — for each slice: read spec → write/confirm failing test → implement → run test green → run full suite → lint/type-check → refactor → commit via `orc:git-commit` → bump checkpoint → next slice.

The agent runs without further user gates UNLESS one of the **escalation conditions** triggers (see `agents/orc-implementer.md`):

- A test can't be made green after 3 attempts.
- A slice spec is ambiguous (multiple valid implementations).
- A new dependency needs to be installed.
- The slice requires touching files outside its declared scope.
- A pre-existing test breaks unexpectedly.
- A security/architecture concern surfaces mid-implementation.
- The plan is wrong (the slice as written would produce incorrect behavior).

When the agent escalates, surface its 🛑 block via `AskUserQuestion`:

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

Echo to the user:

```
✋ Implementation phase. orc paused (--pause-at-implement).

Worktree: <path>
Failing test: <file>:<line>
Plan: .orc/<branch>/files/plan.md

When you're done implementing, re-run /orc:flow (or /orc:resume) and
flow will pick up at QA. The PreToolUse hook will keep you off main —
commit per slice (Conventional Commits via orc:git-commit).
```

The next invocation of `/orc:flow` (or `/orc:resume`) reads the checkpoint and jumps to phase 6.

### Phase 6 — QA

Detect web vs code mode (heuristic on changed files vs main). Invoke `orc:verification-before-completion` (tests + lint + type-check) and `orc:caveman-review` (self-review of diff).

When the diff touches security-sensitive paths (auth, sessions, raw SQL, deserialization, file upload, network egress, dependency surface) — dispatch `orc-security-reviewer` in parallel with the self-review. Merge findings before surfacing.

For web changes, dispatch `orc-qa-validator` (drives `agent-browser`, captures evidence to `.orc/<branch>/files/qa/`).

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

Invoke `/orc:ship` logic:
- `orc:requesting-code-review` (gap check vs the plan)
- `orc:finishing-a-development-branch` (presents structured options)
- `orc:git-commit` (if uncommitted)
- PR composition: caveman-pr if `--caveman` was passed, otherwise the verbose template
- `gh pr create`

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
