---
description: Finalize and open the PR — verifies tests, presents commit/branch/PR options, executes the chosen path, with a soft LOC size-budget gate. Last command before review; adds a Jira Resolves trailer when bound. Workspace-aware.
argument-hint: "[--auto[=guided|full]] [--draft] [--base <branch>] [--verbose] [--max-loc <N>] [--no-size-gate] [--repos a,b | --repo a | --all-repos | --this-repo]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git:*)
  - Bash(gh pr create:*)
  - Bash(gh pr comment:*)
  - Bash(gh pr view:*)
  - Bash(gh auth status:*)
  - Bash(gh pr view:*)
  - Bash(gh pr list:*)
  - Bash(gh pr edit:*)
  - Bash(gh api:*)
  - Bash(jq:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(orc-workspace-detect:*)
  - Bash(orc-pr-size:*)
---

# /orc:ship

Integrate finished work: verify, compose the PR, gate once, size-check, push and open it.

## Arguments

- `--auto[=guided|full]` — autopilot level for this run; overrides `interaction_policy`. Ladder and hard-outward exemption: `orc:gates` §6.
- `--draft` — open the PR as a draft.
- `--base <branch>` — target a non-default base, such as `develop` or `release/v2`.
- `--verbose` — compose the body with the long-form template (orc:ship/P3). Default is terse via `orc:caveman-pr`.
- `--caveman` — accepted as a deprecated no-op alias of the default.
- `--max-loc <N>` — override the per-PR LOC budget P4.5 enforces (default 300; `orc:pr-size-budget`).
- `--no-size-gate` — skip P4.5 entirely, for emergency hot-fixes where review-cycle time dominates. Records nothing in the PR body.
- `--repos a,b | --repo a | --all-repos | --this-repo` — workspace target selection (`orc:workspace-mode`).

NOTE: budget sources, in order: `--max-loc`, `$ORC_PR_LOC_BUDGET`, `<repo_root>/.orc/pr-budget.json#budget`, then 300.

## Preconditions

> **🛑 Outward write**
>
> P5 pushes and opens PRs; P4.5 can open a stack. The P4 gate precedes them. At `--auto=full` with `prMode` settled, P4 opens without asking.

> **⚠️ Caution**
>
> P1 stops the run on a failing test, lint or type-check, uncommitted changes, or a protected branch.

- In workspace mode, no silent broadcast: confirm the repo set before opening multiple PRs.

## Phases

Modules live in `orc:phases` (`references/ship/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Pre-ship verification | `orc:ship/P1` | never |
| 2 Self-request a review | `orc:ship/P2` | never |
| 3 Compose the PR | `orc:ship/P3` | never |
| 4 Branch completion + PR preview | `orc:ship/P4` | never |
| 4.5 Size gate | `orc:ship/P4.5` | `--no-size-gate`; P4 outcome is not "open PR" |
| 5 Push + create PR | `orc:ship/P5` | P4 outcome is not "open PR"; the repo stacked in P4.5 |
| 6 Cleanup hint | `orc:ship/P6` | never |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; the `ORC_*` vars already exist. Do not re-run detection.
2. In workspace mode, resolve `targetRepos` from the flags, else ask via `AskUserQuestion`.
3. Confirm the repo set before opening multiple PRs.

NOTE: the workspace default is every repo in the active session's `repos` array (`orc-state get --field repos`, read-for-data per `orc:state-protocol`).

## Iron rules

- No silent broadcast: confirm before opening multiple PRs.
- Never silently exceed the size budget. Stack, record the override, or abort.
- The size-budget override is a human attestation; autopilot never selects it.
- P4.5 is the single owner of the size decision; `/orc:flow` Phase 7 never pre-flights it.
- The P4 preview is the payload posted.
- QA evidence posts to the PR only after the `orc:evidence-publish` answer; keep-local is the default.

## Output

- A new (or updated) PR on GitHub, or a stack of PRs per repo.
- The PR URLs, echoed.
- No `.orc/` checkpoint: integration is the terminal state. Workspace mode appends to `linkedPRs` in `orc.json` (orc:ship/P5).
