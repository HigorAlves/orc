---
description: Break a too-big branch into a stack of smaller chained PRs — commit-based by default (one PR per Conventional Commit), or --smart for messy branches. Detects gh-stack, falls back to plain gh. Workspace-aware.
argument-hint: "[--smart] [--base <branch>] [--draft] [--max-loc <N>] [--repos a,b | --repo a | --all-repos | --this-repo]"
disable-model-invocation: true
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Agent
  - Bash(orc-workspace-detect:*)
  - Bash(orc-pr-size:*)
  - Bash(git:*)
  - Bash(gh extension install:*)
  - Bash(gh stack:*)
  - Bash(gh-stack:*)
  - Bash(gs:*)
  - Bash(gh pr create:*)
  - Bash(gh pr edit:*)
  - Bash(gh pr view:*)
  - Bash(gh api:*)
  - Bash(jq:*)
  - Bash(GIT_SEQUENCE_EDITOR=* git rebase:*)
  - Bash(git rebase --onto:*)
  - Bash(git rebase --exec:*)
  - Bash(git cherry-pick:*)
  - Bash(git branch:*)
---

# /orc:stack-pr

Convert one big branch into a stack of smaller, chained PRs: one per Conventional Commit by default, or agent-proposed slices with `--smart`.

## Arguments

- `--smart` — dispatch `orc-stack-analyzer` to propose logical slices from the diff instead of commit-based slicing.
  - Use when commits are messy: WIP, fixups, no Conventional Commits.
- `--base <branch>` — target a non-default base (e.g. `develop`). Defaults to `origin/HEAD`.
- `--draft` — open every PR in the stack as a draft.
- `--max-loc <N>` — override the per-slice LOC budget (default: 300).
- `--repos a,b` / `--repo a` / `--all-repos` / `--this-repo` — workspace-mode targeting. See `orc:workspace-mode`.

## Preconditions

> **🛑 Outward write**
>
> P5 pushes N branches and opens N PRs; P6 rewrites every PR body. The P4 preview gate guards both.

> **⚠️ Caution**
>
> P5 reshapes history with cherry-picks. It creates `<branch>-pre-stack-backup` first; the original branch stays safe there.

- Tests pass and lint is clean (`orc:verification-before-completion`, P2).
- The worktree is clean; the branch has no merge commits and at least two commits.
- Use this when the `/orc:ship` size gate fires and the user picks "Stack it", or standalone before the PR.
- Do not invoke for a one-commit branch, or for a hot-fix where review-cycle time dominates (`/orc:ship` with the `Size-budget-override:` trailer).

## Phases

Modules live in `orc:phases` (`references/stack-pr/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Detect tooling | `orc:stack-pr/P1` | never |
| 2 Verify preconditions | `orc:stack-pr/P2` | never |
| 3 Analyze: commit-based slices | `orc:stack-pr/P3` | `--smart` (P3 hands off) |
| Smart analysis | `orc:stack-pr/SMART` | not `--smart` and no switch from P3 |
| 4 Preview and confirm | `orc:stack-pr/P4` | never |
| 5 Execute: backup, reshape, push, open PRs | `orc:stack-pr/P5` | never |
| 6 Body rewrite, metadata writeback | `orc:stack-pr/P6` | never |
| 7 Reviewer hint, summary | `orc:stack-pr/P7` | never |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; `ORC_*` vars are exported. Do not re-run detection.
2. Resolve the per-slice budget with the command below.
3. In workspace mode, resolve `targetRepos` from flags or `AskUserQuestion`.

Budget: `orc-pr-size budget ${ARG_MAX_LOC:+--max-loc "$ARG_MAX_LOC"}`. Per-slice LOC: `orc-pr-size loc --base <slice-base>`.

NOTE: the stack lives per repo; cross-repo stacking is out of scope on purpose.

## Iron rules

- Never auto-install `gh-stack`; the user picks install, plain-gh fallback or cancel.
- Back up before any reshape; the backup branch is non-negotiable.
- A precondition failure stops the run with the failing check and repo. Never "fix it for them".
- If the analyzer reports `unsplittable: true`, stop; never force a split.
- The registry entry goes through `orc-state link-pr`; never hand-write it (`orc:state-protocol`).
- Tables ride the Approve option's `preview`, never inside a callout (`orc:gates` §3).

## Output

- N pushed branches: `<branch>/01-<slug>`, `<branch>/02-<slug>`, ...
- N chained PRs with cross-link tables in their bodies.
- A backup branch, `<branch>-pre-stack-backup`, preserving the original state.
- `${ORC_STATE_DIR}/orc.json` with `linkedPRs[]` carrying the stack metadata.
- A reviewer hint on bottom-up merge order (full convention: `orc:stack-pr` skill, `references/STACKED-PRS.md`).
