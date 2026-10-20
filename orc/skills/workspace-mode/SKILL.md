---
name: workspace-mode
description: Use when cwd is a parent dir holding multiple sibling git repos — defines repo auto-detection, --repos/--repo/--all-repos/--this-repo precedence, per-repo dispatch, and linked-PR mechanics.
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

## State layout and registry schema

Workspace-level `.orc/` holds the shared plan, checkpoint, env state and cross-repo QA; each repo keeps a `workspace-link.json` back-pointer. Read [STATE.md](references/STATE.md) when writing or reading workspace state: the directory layout, the `schemaVersion: 2` registry with `perRepoState`, and the six workspace ↔ single-repo compatibility defenses.

## Per-repo agent dispatch

One implementer per repo, in parallel; agents take `repo`, `repoPath`, `siblingRepos`, `crossRepoContract`. Read [DISPATCH.md](references/DISPATCH.md) when dispatching code-touching agents (`/orc:flow` Phase 5).

## Linked PRs

`/orc:ship` creates one PR per repo, then edits each to cross-link the others with the merge order. Read [LINKED-PRS.md](references/LINKED-PRS.md) at ship time, or when iterating `linkedPRs[]` (`/orc:cleanup`, `/orc:address`): the entry schema, the stack fields, backward compatibility, and the verbose/caveman body templates.

## Branch-name collision handling

`/orc:start` and `/orc:flow` Phase 4 check the branch against every target repo; a divergent branch escalates via `AskUserQuestion`. Read [DISPATCH.md](references/DISPATCH.md) for the state table, the Gate headline, and the five recovery options.

**Iron rule: workspace mode never silently picks.**

## Backward compatibility (workspace ↔ single-repo)

Covered in [STATE.md](references/STATE.md): the `workspace-link.json` stub, disjoint artifact sets, detection precedence, the `scope` discriminator, refuse-and-prompt on collision, and the schema bump.

## Resume + cleanup semantics

- `/orc:resume` (workspace mode, no flag) resumes every repo of the workspace session at the same phase. `--repo a` narrows to one.
- `/orc:resume` from inside a workspace-member repo follows the `workspace-link.json` back-pointer up to the workspace registry and resumes from there.
- `/orc:cleanup` (workspace mode) waits until **all** linked PRs are merged before cleaning per-repo worktrees + state. `--per-repo` overrides to clean each as it merges (rare; use only when you intend to abandon the others).

## When NOT to use workspace mode

- **Single-repo work** — even when cwd happens to be a workspace, if the change touches one repo, run from inside that repo or pass `--this-repo`.
- **Cross-workspace flows** — work that spans repos in different parent dirs is two separate flows. Don't try to staple them together.
- **Sequencing-blocked work** — if repo B can't start until repo A's PR merges, run them as sequential single-repo flows. A coordinated flow is for changes that ship as one logical unit.
