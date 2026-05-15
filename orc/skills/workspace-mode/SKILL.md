---
name: workspace-mode
description: Use when cwd is a parent directory containing multiple sibling git repos (e.g. ~/work/myapp/{api,ui,docs}) — defines auto-detection, --repos/--repo/--all-repos/--this-repo precedence, per-repo agent dispatch, linked-PR mechanics, branch-collision recovery, and workspace ↔ single-repo backward compatibility.
---

# Workspace mode

## Overview

orc auto-detects two contexts at session start:

- **repo** — cwd is inside a git repo. Single-repo mode (the original orc behavior).
- **workspace** — cwd is *not* inside a git repo, but ≥2 immediate child directories *are* git repos.

In workspace mode, one orc flow can span multiple repos: a single shared plan, the same branch name created in each targeted repo, per-repo implementers running in parallel, and N linked PRs at ship time.

**Announce at start:** "I'm using the workspace-mode skill because the SessionStart banner showed `orc context: workspace[…]`."

## Detection

The session-start hook (`hooks/scripts/session-start-using-orc.sh`) sources `lib/workspace-detect.sh` and emits a banner. Commands that need the same context source the helper themselves:

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
# now: $ORC_CONTEXT, $ORC_WORKSPACE_ROOT, $ORC_WORKSPACE_NAME,
#      $ORC_WORKSPACE_REPOS (comma-sep), $ORC_REPO_ROOT, $ORC_STATE_DIR
```

Detection precedence:
1. `git rev-parse --show-toplevel` succeeds → `repo`.
2. ≥2 immediate child dirs of cwd are git repos → `workspace`.
3. Otherwise → `loose` (commands refuse with a hint to `cd`).

The helper is the single source of truth — never reimplement detection inline.

## Flag precedence (repo-touching commands)

When the context is `workspace`, every repo-touching command (`/orc:flow`, `/orc:plan`, `/orc:start`, `/orc:ship`, `/orc:address`, `/orc:qa`, `/orc:debug`, `/orc:cleanup`, `/orc:resume`, `/orc:code-review`, `/orc:fan-out`) honors:

| Flag | Meaning |
|------|---------|
| `--repos a,b,c` | Broadcast to the listed repos. |
| `--repo a` | Narrow to one. Mutually exclusive with `--repos`. |
| `--all-repos` | Broadcast to every detected repo. Skips the prompt. |
| `--this-repo` | Pin to cwd's repo (escape hatch from workspace prompts). |
| *(no flag)* | **Prompt** via `AskUserQuestion`. Options: "all N detected repos / pick a subset / just this repo / cancel". |

**Iron rule (from `using-orc`): no silent broadcast.** A command in workspace mode MUST NOT touch more than the cwd's repo without one of the flags above or a confirming prompt.

## State layout

Workspace = `~/work/myapp/`, branch = `feat/sso-login` → sanitized `feat-sso-login`:

```
~/work/myapp/
├── .orc/                                          # workspace-level (shared)
│   ├── orc.json                                   # workspace registry
│   ├── feat-sso-login/files/
│   │   ├── plan.md                                # SHARED plan, slices tagged repo:
│   │   ├── checkpoint.md                          # flow-level phase tracking
│   │   ├── progress.md                            # rollup of per-repo logs
│   │   └── qa/                                    # cross-repo QA evidence
│   └── .worktrees/
│       ├── api/feat-sso-login/                    # workspace-default tree location
│       └── ui/feat-sso-login/
├── api/.orc/feat-sso-login/files/
│   ├── checkpoint.md                              # this repo's slice cursor
│   ├── progress.md                                # orc-implementer's per-repo log
│   ├── workspace-link.json                        # back-pointer (see below)
│   └── qa/                                        # repo-local QA only
└── ui/.orc/feat-sso-login/files/...
```

Rules:
- `plan.md` is authored once at workspace level. Each slice carries a `repo:` annotation declaring ownership.
- Worktrees default to `<workspace>/.orc/.worktrees/<repo>/<branch>/` — outside the repo, so `.gitignore` collisions are avoided by construction.
- Cross-repo QA (e.g. ui+api integration walks) lives at workspace level. Repo-local QA stays per-repo.

## Registry schema (workspace)

`<workspace>/.orc/orc.json` (`schemaVersion: 2`):

```json
{
  "schemaVersion": 2,
  "context": "workspace",
  "workspaceName": "myapp",
  "workspaceRoot": "/Users/x/work/myapp",
  "repos": [
    { "name": "api", "path": "/Users/x/work/myapp/api", "remote": "git@github.com:acme/api.git" },
    { "name": "ui",  "path": "/Users/x/work/myapp/ui",  "remote": "git@github.com:acme/ui.git" }
  ],
  "sessions": [
    {
      "session_id": "01HYZ...",
      "command": "flow",
      "scope": "workspace",
      "branch": "feat/sso-login",
      "branchSanitized": "feat-sso-login",
      "repos": ["api", "ui"],
      "planPath": ".orc/feat-sso-login/files/plan.md",
      "perRepoState": {
        "api": { "repoPath": "api", "worktree": ".orc/.worktrees/api/feat-sso-login", "currentSlice": 2, "prUrl": null },
        "ui":  { "repoPath": "ui",  "worktree": ".orc/.worktrees/ui/feat-sso-login",  "currentSlice": 1, "prUrl": null }
      },
      "linkedPRs": [],
      "current_phase": 5,
      "total_phases": 9,
      "status": "in_progress",
      "created_at": "2026-05-04T14:10:00Z",
      "updated_at": "2026-05-04T15:02:11Z"
    }
  ]
}
```

Per-repo `<repo>/.orc/orc.json` keeps the existing single-repo schema. New entries set `"scope": "repo"` (existing behavior) or `"scope": "workspace-member"` (back-pointer record only). `/orc:status` and `/orc:resume` discriminate by reading `scope`.

## Per-repo agent dispatch

Code-touching agents accept these new inputs in workspace mode:

| Input | Meaning |
|-------|---------|
| `repo` | Repo name (e.g. `api`). |
| `repoPath` | Absolute path to the repo's worktree. |
| `siblingRepos` | List of names — awareness only; do NOT touch. |
| `crossRepoContract` | Optional pointer to a plan.md section describing the API/wire-format contract between repos. Frozen during implementation. |

Agents updated: `orc-implementer`, `orc-code-fixer`, `orc-test-author`, `orc-pr-reviewer`, `orc-qa-validator`, `orc-debug-investigator`.

**Dispatch pattern**: one implementer per repo, in parallel. Repo boundary is a stricter form of the parallel-safe slice boundary already in `agents/orc-implementer.md` — sibling implementers literally cannot touch each other's files because their worktrees are different directories. Per-repo toolchains and failure isolation argue for per-repo dispatch over a single iterating invocation.

The orchestrator (`commands/flow.md` Phase 5) groups slices by `repo:` tag, then within each repo applies the existing sequential/parallel-batch logic. Outer loop: `for repo in targetRepos: dispatch implementer(s)`.

## Linked PRs

`/orc:ship` runs in two passes:
1. `gh pr create` per repo, capturing each PR URL into the workspace registry's `linkedPRs`.
2. `gh pr edit` per repo, injecting a "Linked PRs" block referencing the others + merge order from the plan.

### Schema

Each entry in `linkedPRs[]` is:

```json
{
  "repo": "api",
  "url": "https://github.com/acme/api/pull/311",
  "stackId": null,
  "stackPosition": null,
  "stackedOn": null
}
```

The three stack fields are populated when `/orc:stack-pr` (or `/orc:ship`'s Phase 4.5 size-gate routing into stack-pr) produced this PR as part of a stack:

| Field | Type | Meaning |
|---|---|---|
| `stackId` | `string \| null` | Stable identifier for the stack group. Format: `<sessionId>-<repo>` in workspace mode, `<sessionId>` in single-repo mode. Reused on re-stack of the same branch. |
| `stackPosition` | `int \| null` | 1-indexed position within the stack. Position 1 is the root (stacked on the base branch). |
| `stackedOn` | `string \| null` | URL of the parent PR (position N-1). `null` for position 1 — its parent is the base branch, not another PR. |

**Backward compatibility.** Pre-stack-support entries are `{repo, url}` only. Readers (e.g. `/orc:cleanup`, `/orc:address`) MUST treat missing `stackId`/`stackPosition`/`stackedOn` as `null` and behave identically to a single-PR session. Writers populate all three fields (using `null` when not stacked) so the shape is uniform going forward.

`/orc:cleanup` groups by `stackId` and enforces bottom-up branch deletion (parents merge before children's branches are deletable). `/orc:address` iterates the array unchanged — stack metadata is additive.

Verbose body (matches default ship template):

```
## Linked PRs

This PR is part of a workspace change spanning N repos:

- org/api#311 — this PR
- org/ui#447 — UI changes

Merge order: api → ui (per workspace plan).
```

Caveman variant (matches `caveman-pr` style):

```
## Linked
api#311 (this) · ui#447
order: api → ui
```

Merge order is sourced from the plan's "Repo touchpoints" section; omit the line if the plan didn't specify one.

## Branch-name collision handling

In workspace mode, `/orc:start` (and `/orc:flow` Phase 4) check the chosen branch against every target repo:

```bash
for r in $repos; do
  git -C "$r" show-ref --verify --quiet "refs/heads/$branch"
done
```

| Repo state | Action |
|------------|--------|
| Branch absent locally and on origin | OK — create. |
| Branch absent locally, present on origin | OK — `git fetch && git worktree add -B`. |
| Branch present, points at base HEAD | OK — adopt. |
| Branch present, has divergent commits | **Conflict — escalate via `AskUserQuestion`.** |

Recovery options on conflict (one prompt covering all conflicting repos at once):

1. **Suffix all repos** — append `-2` to the branch name everywhere so the workspace stays aligned (`feat/sso-login-2` in all repos). The suffix is recorded in the registry.
2. **Suffix only conflicting repos** — keep `feat/sso-login` in clean repos; `feat/sso-login-api` in the dirty one. `perRepoState[<repo>].branch` records the override; `branch` field tracks the canonical name.
3. **Adopt the existing branch** — assume prior work is the intended starting point. Surface the divergent commits in the plan-confirmation gate so the user explicitly opts in.
4. **Pick a different canonical name** — restart the branch-name input.
5. **Abort** — stop the flow; nothing written.

**Iron rule: workspace mode never silently picks.**

## Backward compatibility (workspace ↔ single-repo)

The risk: a workspace flow writes `<workspace>/.orc/feat-sso-login/files/plan.md`. Later the user `cd`s into one repo and runs `/orc:status` — old code would only look at `<repo>/.orc/orc.json` and miss the workspace state.

Defenses:

1. **`workspace-link.json` stub** in every per-repo `<repo>/.orc/<branch>/` written by a workspace flow:
   ```json
   { "scope": "workspace-member", "workspaceRoot": "../..", "workspaceName": "myapp", "sessionId": "01HYZ...", "branch": "feat/sso-login" }
   ```
   `/orc:status` and `/orc:resume` test for this file and walk to the workspace registry when present.
2. **Disjoint artifact sets** — workspace-member dirs never contain `plan.md`; single-repo dirs always do. Presence of `plan.md` is the second-line collision detector.
3. **Detection precedence** — if cwd is inside a repo, the helper returns `repo` even when that repo lives under a workspace. Routing-up happens via the link file.
4. **`scope` discriminator** on every registry entry. Legacy entries with no `scope` are read as `repo` by default.
5. **Refuse-and-prompt on real collision** — workspace flow refuses to overwrite a per-repo `.orc/<branch>/` whose `plan.md` exists and is not workspace-member; user picks rename or `/orc:cleanup` evict.
6. **Schema bump** — `schemaVersion: 2` (workspace-aware). Reads handle both; writes upgrade in place.

## Resume + cleanup semantics

- `/orc:resume` (workspace mode, no flag) resumes every repo of the workspace session at the same phase. `--repo a` narrows to one.
- `/orc:resume` from inside a workspace-member repo follows the `workspace-link.json` back-pointer up to the workspace registry and resumes from there.
- `/orc:cleanup` (workspace mode) waits until **all** linked PRs are merged before cleaning per-repo worktrees + state. `--per-repo` overrides to clean each as it merges (rare; use only when you intend to abandon the others).

## When NOT to use workspace mode

- **Single-repo work** — even when cwd happens to be a workspace, if the change touches one repo, run from inside that repo or pass `--this-repo`.
- **Cross-workspace flows** — work that spans repos in different parent dirs is two separate flows. Don't try to staple them together.
- **Sequencing-blocked work** — if repo B can't start until repo A's PR merges, run them as sequential single-repo flows. A coordinated flow is for changes that ship as one logical unit.
