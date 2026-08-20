---
description: End-to-end feature/bug/refactor pipeline (plan → start → implement → QA → ship → address → cleanup) with an interactive gate at every phase. Resumable via /orc:resume. --jira <KEY> links a ticket. Workspace-aware.
argument-hint: "[--auto[=guided|full]] [--type=feature|bug|refactor|docs] [--rfc] [--verbose] [--pause-at-implement] [--jira <KEY>] [--max-loc <N>] [--no-size-gate] [--driver agent-browser|chrome] [--repos a,b | --repo a | --all-repos | --this-repo] <one-line task description>"
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
  - Bash(git:*)
  - Bash(gh:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(go:*)
  - Bash(cargo:*)
  - Bash(pytest:*)
  - Bash(curl:*)
  - Bash(node:*)
  - Bash(date:*)
  - Bash(agent-browser:*)
  - Bash(acli:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
  - Bash(orc-pr-size:*)
  - Bash(orc-docker-env:*)
effort: high
---


# /orc:flow

Drive a piece of work from "I want to do X" to "PR merged, workspace cleaned up." `/orc:flow` is the umbrella — it walks the same phases the individual commands do, but with unified state, gates at genuine decision points, and a single resume entry point.

Interactivity follows the gate taxonomy (`orc:using-orc`) and the resolved `interaction_policy` (the banner's `policy:` segment): real choices gate via `AskUserQuestion`; machine-verified outcomes (clean red, QA pass with a complete packet) print their evidence and advance; hard-outward gates always ask at every level. Immediately before each gate, print the one-line `> **⛔ Gate — <phase>**` callout per `orc:callouts` (options never go inside the callout).

## Arguments

- `<task description>` — required. One sentence describing the work.
- `--auto[=guided|full]` — autopilot level for this run (bare `--auto` = full). Overrides the configured `interaction_policy`. See "Autopilot" below.
- `--type=feature|bug|refactor|docs` — optional; pre-answers the triage type question. The type changes which phases run.
- `--rfc` — insert an RFC phase before planning (multi-week, multi-team, or genuine-alternatives work).
- `--verbose` — pass through to `/orc:ship` (long-form PR body; terse `orc:caveman-pr` is the default).
- `--driver agent-browser|chrome` — pre-answers Phase 6's browser-driver gate.
- `--pause-at-implement` — Phase 5 pauses for the human to write the code (keeps Phase 4's red-confirm gate).
- `--jira <KEY>` — link a Jira ticket silently (validate `^[A-Z][A-Z0-9_]*-\d+$`); lands as `Resolves <KEY>` in the PR body.
- `--max-loc <N>` / `--no-size-gate` — pass-through to `/orc:ship`'s Phase 4.5 size gate (single owner; flow never pre-flights it).
- `--repos a,b` / `--repo a` / `--all-repos` / `--this-repo` — workspace-mode targeting per `orc:workspace-mode`.

Every flag records its answer as a settled decision (`orc-state decision set … --provenance flag`) so nested commands never re-ask.

## Phases

**9 phases; the playbooks for Phases 2–9 load one at a time via `orc:flow-phases` — entering phase N, Read exactly its `references/PHASE-<N>-*.md` first. Do not run a phase from memory.** Decision points gate; machine-verified outcomes print evidence and advance.

| # | Phase | Always? | Skips when … |
|---|-------|---------|--------------|
| 1 | Triage + contract (below — always in context) | yes | — |
| 2 | RFC | optional | `--rfc` absent and not flagged in triage |
| 3 | Plan (+ slice ledger install) | yes | type=docs uses `/orc:scaffold` instead |
| 4 | Start — worktree + failing test | for code | type=docs skips |
| 5 | Implement — orc-implementer batches from the ledger | for code | type=docs writes docs in conversation |
| 6 | QA — `orc:browser-qa` for web + qa-verdict.json | yes | type=docs runs lint only |
| 7 | Ship — `/orc:ship` logic; ship owns the size gate | yes | — |
| 8 | Address — reviewer-comment loop | optional | no comments → exit note |
| 9 | Cleanup — post-merge | yes | — |

For `--type=bug`, phases 2–3 collapse into a single `/orc:debug` invocation (diagnosis + regression test + plan in one).

### Phase 0 — Detect context

The context banner is injected below (`ORC_*` vars are also exported for any Bash you run — do not re-run detection):

!`orc-workspace-detect --banner`

- `ORC_CONTEXT=repo` → standard single-repo flow. Skip workspace-only steps below.
- `ORC_CONTEXT=workspace` → workspace flow. The state dir is `$ORC_STATE_DIR` (`<workspaceRoot>/.orc`); per-repo state dirs are `<workspaceRoot>/<repo>/.orc/`.
- `ORC_CONTEXT=loose` → surface and stop:

  ```markdown
  > **⚠️ Caution**
  >
  > Cwd is neither a git repo nor a workspace parent — cannot run /orc:flow here.
  ```

### Phase 1 — Triage

If the user provided a long-form PRD, a Jira/issue link, or a multi-paragraph brief — dispatch `orc-prd-analyzer` via `Task` first. The agent returns a structured analysis (goals, ambiguities, P0/P1/P2 clarifying questions). Use its recommendation to gate progression: if P0 questions exist, surface them and ask the user to either answer here or pause the flow until they're resolved with the PM.

If the input is a short one-liner ("add CSV export"), skip the analyzer and proceed.

**One triage gate.** Everything still undecided is asked in a SINGLE `AskUserQuestion` call — it carries up to 4 questions, which is exactly the triage set. A flag pre-answers its question and drops it from the call; so does a **settled decision** (`orc-state decision get <key>` per `orc:state-protocol` — echo `using settled decision: <key>=<value> (<provenance>)`). Every answer collected here is recorded via `orc-state decision set` so nested commands never re-ask. When everything is pre-answered, Phase 1 asks nothing.

1. **Type** (dropped when `--type=` passed):
   - feature — new capability, plan + start + ship loop
   - bug — root-cause investigation, then fix with TDD
   - refactor — restructuring without changing behavior
   - docs — README, architecture, ADR/RFC, Diátaxis quadrants
   - (free-form via Other: "something else — let me describe")
2. **Scope** (always asked):
   - < 1 day — small; skip RFC, simple plan
   - 1–5 days — medium; full plan, optional grill-me
   - 1–4 weeks — big; suggest --rfc; offers /orc:rfc next
   - multi-quarter — too big for /orc:flow; suggests breaking down with /orc:plan --issues first
3. **Repo set** (workspace mode only; dropped when `--repos`/`--repo`/`--all-repos`/`--this-repo` passed): "This is a workspace with N repos: <list from $ORC_WORKSPACE_REPOS>. Scope this flow to which repos?"
   - All N detected repos
   - Pick a subset (multi-select follow-up)
   - Just this repo (cwd) — only when cwd is inside a workspace child
   - Cancel
4. **Jira link** (dropped when `--jira` passed, or when the tracker layer declares no Jira per `orc:tracker-config` — then record `jiraTicket=none` as an inferred decision silently): "Link a Jira ticket to this flow?"
   - Paste a key (then prompt for the key; validate `^[A-Z][A-Z0-9_]*-\d+$`, re-ask on mismatch)
   - Skip — I'll bind later via /orc:jira bind
   - No ticket — this work has no tracker entry

If `--jira <KEY>` was passed, validate against `^[A-Z][A-Z0-9_]*-\d+$`; reject and stop on mismatch.

Record the resolved repo set as `targetRepos` in `checkpoint.md`. When the resolved set has exactly one repo and the user is inside that repo via `--this-repo`, treat the rest of the flow as a single-repo flow against that `repoPath` (no workspace state).

**Iron rule (no silent broadcast):** workspace mode never proceeds past Triage without an explicit repo set — the repo-set question is bundled, never inferred or defaulted.

Register state: `orc-state init --command flow --total-phases 9 [--jira <KEY>]` (adjust `--total-phases` for skipped phases; workspace mode adds `--scope workspace --repos <targetRepos>`). Defer to `orc:state-protocol` for schema and rules; per phase boundary, `orc-state phase set <n>` + `orc-state digest write -`.

In workspace mode, also seed each target repo's `<workspaceRoot>/<repo>/.orc/<sanitized-branch>/workspace-link.json`:

```json
{ "scope": "workspace-member", "workspaceRoot": "<absolute path>", "workspaceName": "<name>", "sessionId": "<id>", "branch": "<branch>" }
```

This is the back-pointer `/orc:status` and `/orc:resume` follow when the user `cd`s into one repo.

## Autopilot (the sprint contract)

The resolved policy (flag > settled decision > env > userConfig > `manual`) sets how much of the run needs you:

- **manual** — every soft-inward gate asks, exactly as the phase playbooks specify.
- **guided** — mechanical confirms auto-advance with a printed one-liner: the driver defaults to `agent-browser` (recorded as a policy decision), a clean QA pass advances, Phase 9 auto-applies the standard cleanup plan. Plan approval, the size gate, and PR compose still ask.
- **auto (full)** — Phases 1–3 collapse into **one contract gate**: infer type/scope from the description (recorded as inferred decisions; `orc-prd-analyzer` still runs for long briefs and P0 questions still stop the run), draft the plan, then a single `AskUserQuestion` call:
  1. **Approve the contract** — the deliverable one-liner, the slice list, and the testable success criteria: suite + lint + type-check green, every `slices.json` acceptance criterion `pass` in `qa-verdict.json`, `orc-state slice list --status pending,red,escalated` clean, PR ≤ budget or stacked, CI green on the PR. Options: approve / iterate the plan / abort.
  2. **Repo set** (workspace mode only — asked at every level, never inferred; iron rule 7).
  3. **Jira link** (dropped when settled or the tracker layer has no Jira).
  4. **Run policy** — driver, PR mode (non-draft caveman body), size-over handling (auto-stack from slices — auto NEVER selects the size-budget override; that attestation stays human, iron rule 8), cleanup (standard plan).

  On approval the contract is recorded in `decisions.json` and **Phases 4–9 run without inward gates**, stopping only for escalation-only conditions (implementer escalations, env `failed`, CI `needs-debug`/`infra`, QA `fail`/`partial`) or a criteria miss — either re-opens exactly that one decision with the evidence.

**Hard-outward gates ask at every level** — evidence publish to a tracker, posting PR reviews, tracker writes. `--auto` has no effect on them.

## Resume

If interrupted at any phase, `/orc:resume` re-enters at the next pending phase. Or just re-run `/orc:flow` — self-resume runs the **session-startup sequence from `orc:state-protocol`** (entry via `orc-state current` → bounded checkpoint → git cross-check vs the digest → slice list → the one artifact the digest's `Next:` names → `orc-state verify`) and jumps forward. Flow's self-resume is scoped: it may only resume an `in_progress` `command: "flow"` session on the **current branch**; anything else is handed to `/orc:resume`.

This means a typical workday looks like:

```
Monday morning:    /orc:flow "add CSV export to reports"
                   → triage, RFC skipped (small scope), plan, start
                   → orc pauses at phase 5

Monday afternoon:  (user implements, commits per slice)

Tuesday morning:   /orc:flow  (no args; reads checkpoint, picks up at QA)
                   → QA, ship
                   → orc exits at phase 8 (PR open; handoff note)

Tuesday afternoon: reviewers comment
                   /orc:flow  (reads checkpoint, routes to address)
                   → address loop

Wednesday: PR merges
                   /orc:flow  (reads checkpoint, runs cleanup)
                   → cleanup
                   → flow done
```

## Iron rules in play

- **Every gate is a real gate.** A gate that fires is never silently advanced past. Phases whose outcome is machine-verified (clean red, clean QA pass) print their evidence and advance — the moment the evidence is anomalous, the gate is back. The user can always abort, iterate, or skip at any gate.
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
