---
description: Start a feature — set up an isolated worktree, draft the plan, and write the first failing test before any production code. --jira <KEY> links a ticket and informs the branch name. Workspace-aware.
argument-hint: "[--worktree <path>] [--jira <KEY>] [--repos a,b | --repo a | --all-repos | --this-repo] <feature description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git *)
  - Bash(acli jira workitem view:*)
  - Bash(jq *)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(go *:*)
  - Bash(cargo *:*)
  - Bash(pytest *:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:start

Kick off a new feature with isolation, a written plan, and the first failing test — all before production code is touched. The TDD red light is the entry gate.

## Arguments

- `--worktree <path>` — optional explicit worktree directory. If omitted, the worktree skill picks one safely.
- `--jira <KEY>` — optional. Link a Jira ticket key (e.g. `JRA-123`) to this session. Two effects: (1) Phase 1 fetches the ticket summary via `acli jira workitem view <KEY> --fields "summary" --json`, slugifies it, and offers `feat/<KEY>-<slug>` as the suggested branch name to `orc:using-git-worktrees`; (2) the flag is forwarded to `/orc:plan` in Phase 2, suppressing the Phase 1 link prompt and writing `jiraTicket: <KEY>` into the session's `.orc/` state. Validate against `^[A-Z][A-Z0-9_]*-\d+$`.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection).

In workspace mode, resolve `targetRepos` from `--repos`/`--repo`/`--all-repos`/`--this-repo` or via `AskUserQuestion`. Iron rule: no silent broadcast.

### Phase 1 — Worktree(s)

Invoke `orc:using-git-worktrees`. Create an isolated worktree off the current default branch (typically `main`). Switch the session to that worktree. The PreToolUse hook will refuse subsequent commits to `main`/`master`/`develop`, so you must be on a feature branch from this point.

If `--jira <KEY>` was passed: invoke `orc:jira-cli` and run `acli jira workitem view "$KEY" --fields "summary" --json | jq -r '.fields.summary'`. Slugify (lowercase, replace non-`[a-z0-9-]` with `-`, collapse repeats, trim leading/trailing `-`). Suggest `feat/<KEY>-<slug>` as the branch name to `orc:using-git-worktrees`. The user can accept or override.

**Workspace mode**: repeat the worktree+branch step for **every repo** in `targetRepos`. Default worktree path is `${ORC_WORKSPACE_ROOT}/.orc/.worktrees/<repo>/<sanitized-branch>/` (the worktrees skill recognizes workspace mode and prefers this location).

Run a **branch-collision check** for every target repo before creating worktrees:

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
| Branch present, has divergent commits | **Conflict** — `AskUserQuestion`. |

On conflict, print first (then the table above stays as the detail):

```markdown
> [!WARNING]
> **⛔ Gate — branch collision**
>
> `<branch>` already exists with divergent commits in: <repo list>.
```

Conflict recovery options (one prompt covering all conflicting repos at once):

1. Suffix all repos with `-2` (or user-chosen short suffix) — workspace stays branch-aligned.
2. Suffix only conflicting repos (e.g. `feat/sso-login-api`); keep canonical name elsewhere.
3. Adopt existing branch (surface divergent commits before continuing).
4. Pick a different canonical name.
5. Abort.

Record any per-repo branch overrides in `checkpoint.md` and `perRepoState[<repo>].branch`.

### Phase 2 — Plan

Invoke `/orc:plan` (skip `--issues`, skip `--grill` unless user opts in). Forward `--jira <KEY>` if it was passed to `/orc:start` — `/orc:plan`'s Phase 1 prompt will be suppressed and the link recorded silently in `${ORC_STATE_DIR}/orc.json` + `checkpoint.md`. The plan is written to `${ORC_STATE_DIR}/<branch>/files/plan.md`. Forward `--repos`/`--repo`/`--all-repos`/`--this-repo` so `/orc:plan` doesn't re-prompt and the plan template gets workspace-mode sections (Repo touchpoints, Cross-repo contract, Merge order, per-slice `repo:` tags).

### Phase 3 — First failing test

Invoke `orc:tdd`. Per its red-green-refactor doctrine:
1. Pick the first vertical slice from the plan.
2. Write the test that demonstrates the desired behavior.
3. Run the test suite — it MUST fail with the expected message (not "test not found", not a setup error).
4. If the failure isn't the right one, fix the test until it is.
5. Stop. Do NOT implement yet. The whole point is that the next session knows exactly where to start.

In workspace mode, the first failing test goes in whichever repo the plan's slice 1 declares via `repo:`. `cd` into that repo's worktree before invoking `orc:tdd`. Commit the failing test in that repo's branch.

### Phase 4 — Checkpoint

Update `${ORC_STATE_DIR}/<branch>/files/checkpoint.md` (phase=ready-for-implementation, last_artifact=test-file:line). Update `${ORC_STATE_DIR}/orc.json`. In workspace mode, also update each per-repo `<workspaceRoot>/<repo>/.orc/<branch>/checkpoint.md` (slice cursor) and ensure each repo's `workspace-link.json` back-pointer is in place.

## Output

- New worktree at `<chosen-path>` on a feature branch
- `.orc/<branch>/files/plan.md`
- One failing test in the codebase, committed (per `orc:git-commit`)
- Checkpoint set to `ready-for-implementation`

## Resume

`/orc:resume` will pick up at the implementation phase — that's where `/orc:start` deliberately stops.
