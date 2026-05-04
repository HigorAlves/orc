---
description: Finalize and open the PR. Verifies tests pass, presents structured commit/branch/PR options, executes the chosen path. Last command before review. If the active session has a bound jiraTicket in .orc/orc.json, the PR body gets a `Resolves <KEY>` trailer (configurable via $ORC_JIRA_PR_KEYWORD). Workspace-aware — opens N linked PRs with reciprocal cross-links + merge order.
argument-hint: "[--draft] [--base <branch>] [--caveman] [--repos a,b | --repo a | --all-repos | --this-repo]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git *)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(gh pr list:*)
  - Bash(gh pr edit:*)
  - Bash(gh api:*)
  - Bash(jq *)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
  - Bash(. */lib/workspace-detect.sh*)
---

# /orc:ship

You're done implementing. Time to integrate. This command runs the structured branch-completion flow.

## Arguments

- `--draft` — open the PR as a draft.
- `--base <branch>` — target a non-default base (e.g. `develop`, `release/v2`).
- `--caveman` — compose the PR title and body using `orc:caveman-pr` (terse, signal-only). Default is the verbose template documented in Phase 4.

## Workflow

### Phase 0 — Detect context

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

In workspace mode, resolve `targetRepos` from flags or via `AskUserQuestion`. Default in workspace mode is to ship every repo in the active workspace session's `repos` array (resolve via `${ORC_STATE_DIR}/orc.json`). Iron rule: no silent broadcast — confirm before opening multiple PRs.

### Phase 1 — Pre-ship verification

Invoke `orc:verification-before-completion`. Confirm:
- Tests pass.
- Lint / type-check pass (if configured).
- No staged-but-uncommitted changes (`git status --porcelain`).
- Current branch is NOT a protected branch.

If any check fails, stop and show the failure. Do not proceed.

In workspace mode, run all four checks **per target repo** (cd into each `repoPath`). If any one repo fails, stop and surface which repo + which check; the other repos are not pushed.

### Phase 2 — Self-request a review

Invoke `orc:requesting-code-review`. The skill walks through whether the work meets requirements and is review-ready. If the skill flags gaps, surface them; user decides whether to proceed.

### Phase 3 — Branch completion options

Invoke `orc:finishing-a-development-branch`. The skill presents structured options via `AskUserQuestion` (typically: open PR / merge directly / keep working / discard). Execute the chosen option.

If the user picks "open PR":

### Phase 4 — Compose PR

Invoke `orc:git-commit` if there are uncommitted changes. Then:

1. Determine PR title from the branch name + recent commit subjects.
2. Compose the body. Two modes:
   - **Default (verbose)** — sections: **What** (one-paragraph summary), **Why** (link to plan / issue / PRD if available; `.orc/<branch>/files/plan.md` if present), **How tested** (test commands run; browser QA artifacts if web change at `.orc/<branch>/files/qa/`), **Checklist** (boxes for the reviewer).
   - **`--caveman` mode** — invoke `orc:caveman-pr` and follow it exactly. Skips the verbose template; returns a tight title + body with only the sections that add signal (Why / What changed / How tested / Notes / trailers). Best when the diff is small or the PR template is heavyweight.
3. **Append the Jira trailer if a ticket is bound.** Read the active session's `jiraTicket` from `.orc/orc.json` (find the entry whose `branch` matches the sanitized current branch). If present, append a single trailer line at the bottom of the body:

   ```
   <KEYWORD> <KEY>
   ```

   `KEYWORD` defaults to `Resolves`. Override per-shop with `export ORC_JIRA_PR_KEYWORD=Closes` (or `Fixes`). Both modes (verbose and caveman) get this trailer. Skip silently when no `jiraTicket` is set.
4. Show the user the title + body via `AskUserQuestion`: `Open as-is` / `Edit first` / `Cancel`.

### Phase 5 — Push + create PR

```
git push -u origin <branch>
gh pr create --title "<title>" --body "<body>" [--draft] [--base <base>]
```

Echo the PR URL.

In workspace mode, this becomes a **two-pass loop**:

**Pass 1 — push + create per repo** (sequential, since `gh pr create` should observe a clean push):

```bash
for r in $targetRepos; do
  cd "$ORC_WORKSPACE_ROOT/$r"
  branch=$(jq -r ".sessions[] | select(.branch == \"$BRANCH\") | .perRepoState.\"$r\".branch // \"$BRANCH\"" "$ORC_STATE_DIR/orc.json")
  git push -u origin "$branch"
  pr_url=$(gh pr create --title "<title>" --body "<body-without-cross-links-yet>" [--draft] [--base <base>])
  jq --arg r "$r" --arg url "$pr_url" \
     '(.sessions[] | select(.branch == "'"$BRANCH"'") | .linkedPRs) += [{repo: $r, url: $url}]' \
     "$ORC_STATE_DIR/orc.json" > tmp && mv tmp "$ORC_STATE_DIR/orc.json"
done
```

**Pass 2 — inject reciprocal "Linked PRs" block** (after all PRs exist, since PR #1 doesn't know PR #2's number at creation time):

For each PR, `gh pr edit <url> --body "$(updated body)"` where the updated body appends:

Verbose template:
```
## Linked PRs

This PR is part of a workspace change spanning N repos:

- org/api#311 — this PR
- org/ui#447 — UI changes

Merge order: api → ui (per workspace plan).
```

Caveman template (when `--caveman`):
```
## Linked
api#311 (this) · ui#447
order: api → ui
```

Merge order is sourced from the plan's "Merge order" line; omit the line if absent.

Echo all N PR URLs to the user.

### Phase 6 — Cleanup hint

If the user opted for "merge after CI" rather than "wait for review," surface a reminder to come back with `/orc:address` if reviewers leave comments.

After the PR merges in GitHub, the user should run **`/orc:cleanup`** to remove the `.orc/<branch>/` workspace state, the associated git worktree (if `using-git-worktrees` was used), and the local feature branch (if it merged cleanly). Surface this hint as the last line of `/orc:ship`'s output so the lifecycle closes properly.

## Output

- A new (or updated) PR on GitHub
- PR URL echoed to the user
- (No `.orc/` writes — `/orc:ship` doesn't checkpoint; integration is the terminal state.)
