---
description: Finalize and open the PR — verifies tests, presents commit/branch/PR options, executes the chosen path, with a soft LOC size-budget gate. Last command before review; adds a Jira Resolves trailer when bound. Workspace-aware.
argument-hint: "[--draft] [--base <branch>] [--verbose] [--max-loc <N>] [--no-size-gate] [--repos a,b | --repo a | --all-repos | --this-repo]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git:*)
  - Bash(gh pr create:*)
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

You're done implementing. Time to integrate. This command runs the structured branch-completion flow.

## Arguments

- `--draft` — open the PR as a draft.
- `--base <branch>` — target a non-default base (e.g. `develop`, `release/v2`).
- `--verbose` — compose the PR body with the long-form template documented in Phase 4. Default is terse, signal-only composition via `orc:caveman-pr`. (`--caveman` is accepted as a deprecated no-op alias of the default.)
- `--max-loc <N>` — override the per-PR LOC budget enforced by Phase 4.5 (default: 300, configurable via `$ORC_PR_LOC_BUDGET` or `<repo_root>/.orc/pr-budget.json#budget`). See `orc:pr-size-budget`.
- `--no-size-gate` — bypass Phase 4.5 entirely. Use for emergency hot-fixes where review-cycle time dominates. Records nothing in the PR body.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection).

In workspace mode, resolve `targetRepos` from flags or via `AskUserQuestion`. Default in workspace mode is to ship every repo in the active workspace session's `repos` array (`orc-state get --field repos` — read-for-data per `orc:state-protocol`). Iron rule: no silent broadcast — confirm before opening multiple PRs.

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

### Phase 3 — Compose PR (no gate)

Compose **before** asking anything — the completion decision and the PR preview then fit in one gate (Phase 4) instead of two.

Invoke `orc:git-commit` if there are uncommitted changes. Then:

1. Determine PR title from the branch name + recent commit subjects.
2. Compose the body. Two modes:
   - **Default (terse)** — invoke `orc:caveman-pr` and follow it exactly: a tight title + body with only the sections that add signal (Why / What changed / How tested / Notes / trailers). Reviewers need a why and a how-tested, not a tour of the diff.
   - **`--verbose` mode** — the long-form template: **What** (one-paragraph summary), **Why** (link to plan / issue / PRD if available; `.orc/<branch>/files/plan.md` if present), **How tested** (test commands run; browser QA artifacts if web change at `.orc/<branch>/files/qa/`), **Checklist** (boxes for the reviewer). Use when the change genuinely needs narrative context (big migrations, multi-team reviews).
3. **Append the Jira trailer if a ticket is bound.** `orc-state get --field jiraTicket` (read-for-data per `orc:state-protocol`). If present, append a single trailer line at the bottom of the body:

   ```
   <KEYWORD> <KEY>
   ```

   `KEYWORD` defaults to `Resolves`. Override per-shop with `export ORC_JIRA_PR_KEYWORD=Closes` (or `Fixes`). Both modes (terse and verbose) get this trailer. Skip silently when no `jiraTicket` is set.

### Phase 4 — Branch completion + PR preview (one gate)

Invoke `orc:finishing-a-development-branch` in its **caller-supplied preview mode**, passing the composed title + body. The skill renders the preview and asks ONE question: open as previewed / open as draft / edit title-body first / another completion path (merge back locally, keep as-is, discard — follow-up per the skill). The preview shown is the payload posted.

(When `/orc:flow` Phase 7 drives this logic, it skips the completion options — the flow's premise is already "open a PR" — and gates only the composed preview. Standalone `/orc:ship` always offers the full set.)

If the outcome is "open PR" (as-is or draft):

### Phase 4.5 — Size gate

Defer to `orc:pr-size-budget` for the canonical mechanics. Skip this phase entirely when `--no-size-gate` is set.

For each target repo (workspace mode iterates; single-repo runs once):

```bash
base="${ARG_BASE:-$(git symbolic-ref refs/remotes/origin/HEAD --short | sed 's@^origin/@@')}"
orc-pr-size gate --base "origin/$base" ${ARG_MAX_LOC:+--max-loc "$ARG_MAX_LOC"}
```

One call returns `loc:`, `budget:`, `verdict:`, the top-contributors table, and the excluded-files line. If `verdict: under`, fall through to Phase 5.

If `verdict: over`, render the gate exactly as `orc:pr-size-budget` specifies (the `[!WARNING]` **⛔ Gate — PR size** callout, then the breakdown + exclusions from the gate output above) and surface `AskUserQuestion`:

1. **Stack from plan slices (Recommended when shown)** — shown only when the session's `slices.json` ledger exists and every slice is `committed` with a distinct recorded `commit` sha (`orc-state slice list` — no heuristics; the ledger IS the commit↔slice map. Pre-ledger fallback: `n_commits_on_branch == n_slices_in_plan` with best-effort subject match). Uses those per-slice commits as the stack scaffold: load `orc:stack-pr` inline with the commit-based strategy pinned, one PR per slice batch. Records the resulting `linkedPRs[]` entries and **short-circuits Phase 5** for this repo.
2. **Stack it** — invoke `/orc:stack-pr` **inline as a skill** (load `stack-pr` skill in this session, run its phases; `--smart` reshape available). Same short-circuit as option 1, but doesn't rely on commit/slice alignment. Recommended when option 1 is hidden.
3. **Open as one big PR** — prompt for a one-line reason (free text). Append to the PR body as the trailer:
   ```
   Size-budget-override: <reason>
   ```
   placed after any Jira / `Closes #N` trailers. Continue to Phase 5 with the augmented body.
4. **Abort** — exit non-zero with a hint: "Resize the diff and re-run `/orc:ship`, or run `/orc:stack-pr` directly when ready."

This gate is the **single owner** of the size decision — `/orc:flow` Phase 7 never pre-flights it. In a flow session, per-repo decisions land in flow's `checkpoint.md` so `/orc:resume` knows the repo already gated.

In **workspace mode**, the gate fires per repo inside the existing `for r in $targetRepos` loop. Each repo gets its own decision — one repo can stack while another opens single. Per-repo `stackId` is derived as `<sessionId>-<repo>` (see Phase 5 Pass 1 below).

Iron rule: never silently exceed the budget. Either stack, record the override, or abort.

### Phase 5 — Push + create PR

```
git push -u origin <branch>
gh pr create --title "<title>" --body "<body>" [--draft] [--base <base>]
```

Echo the PR URL.

In workspace mode, this becomes a **two-pass loop**:

**Pass 1 — push + create per repo** (sequential, since `gh pr create` should observe a clean push). Skip any repo whose Phase 4.5 already produced a stack (its `linkedPRs[]` entries are populated and `gh pr create` would create a duplicate):

```bash
for r in $targetRepos; do
  cd "$ORC_WORKSPACE_ROOT/$r"
  # If Phase 4.5 already opened a stack for this repo, skip — entries are in linkedPRs already.
  already_stacked=$(jq -r --arg r "$r" --arg b "$BRANCH" \
    '.sessions[] | select(.branch == $b) | .linkedPRs | map(select(.repo == $r and .stackId != null)) | length' \
    "$ORC_STATE_DIR/orc.json")
  [ "${already_stacked:-0}" -gt 0 ] && continue

  branch=$(jq -r ".sessions[] | select(.branch == \"$BRANCH\") | .perRepoState.\"$r\".branch // \"$BRANCH\"" "$ORC_STATE_DIR/orc.json")
  git push -u origin "$branch"
  pr_url=$(gh pr create --title "<title>" --body "<body-without-cross-links-yet>" [--draft] [--base <base>])
  jq --arg r "$r" --arg url "$pr_url" \
     '(.sessions[] | select(.branch == "'"$BRANCH"'") | .linkedPRs) += [{repo: $r, url: $url, stackId: null, stackPosition: null, stackedOn: null}]' \
     "$ORC_STATE_DIR/orc.json" > tmp && mv tmp "$ORC_STATE_DIR/orc.json"
done
```

**Pass 2 — inject reciprocal "Linked PRs" block** (after all PRs exist, since PR #1 doesn't know PR #2's number at creation time):

For each PR, `gh pr edit <url> --body "$(updated body)"` where the updated body appends:

Default (terse) template:
```
## Linked
api#311 (this) · ui#447
order: api → ui
```

`--verbose` template:
```
## Linked PRs

This PR is part of a workspace change spanning N repos:

- org/api#311 — this PR
- org/ui#447 — UI changes

Merge order: api → ui (per workspace plan).
```

Merge order is sourced from the plan's "Merge order" line; omit the line if absent.

Echo all N PR URLs to the user.

### Phase 6 — Cleanup hint

If the user opted for "merge after CI" rather than "wait for review," surface a reminder to come back with `/orc:address` if reviewers leave comments.

After the PR merges in GitHub, the user should run **`/orc:cleanup`** to remove the `.orc/<branch>/` workspace state, the associated git worktree (if `using-git-worktrees` was used), and the local feature branch (if it merged cleanly). Surface this as the last block of `/orc:ship`'s output so the lifecycle closes properly:

```markdown
> **➡️ Next**
>
> After the PR merges, run `/orc:cleanup` to remove the `.orc/<branch>/` state, the worktree, and the merged branch.
```

## Output

- A new (or updated) PR on GitHub
- PR URL echoed to the user
- (No `.orc/` writes — `/orc:ship` doesn't checkpoint; integration is the terminal state.)
