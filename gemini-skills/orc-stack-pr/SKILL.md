---
name: orc-stack-pr
description: Break a too-big branch into a stack of smaller chained PRs. Default strategy is commit-based (one PR per Conventional Commit on base..HEAD). Use --smart to dispatch the orc-stack-analyzer agent for messy branches. Detects gh-stack; falls back to plain-gh if absent. Writes per-PR stack metadata into .orc/orc.json#linkedPRs[]. Workspace-aware — operates per repo.
---
# /orc:stack-pr

Convert a single big branch into a stack of smaller, chained PRs. Use this when the size gate fires on `/orc:ship`, or anytime you've ended up with a 600-LOC branch and want to break it down before review.

## Arguments

- `--smart` — dispatch the `orc-stack-analyzer` agent to propose logical slices from the diff (rather than the default commit-based slicing). Use when commits are messy (WIP, fixups, no Conventional Commits).
- `--base <branch>` — target a non-default base (e.g. `develop`). Defaults to `origin/HEAD`.
- `--draft` — open every PR in the stack as a draft.
- `--max-loc <N>` — override the per-slice LOC budget (default: 300).
- `--repos a,b` / `--repo a` / `--all-repos` / `--this-repo` — workspace-mode targeting. See `orc:workspace-mode`.

## Workflow

### Phase 0 — Detect context

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
. "${CLAUDE_PLUGIN_ROOT}/lib/pr-size-budget.sh"
```

In workspace mode, resolve `targetRepos` from flags or `AskUserQuestion`. The stack lives **per repo**; cross-repo stacking is intentionally out of scope.

### Phase 1 — Detect tooling

```bash
if command -v gh-stack >/dev/null 2>&1; then
  STACK_TOOL="gh-stack"
elif gh stack --help >/dev/null 2>&1; then
  STACK_TOOL="gh-stack-ext"
else
  STACK_TOOL="none"
fi
```

If `none`, present `AskUserQuestion`:

1. **Install** — run `gh extension install github/gh-stack`. Continue when complete.
2. **Use plain-gh fallback** — chain via `gh pr create --base <prev-branch>` per layer. No extension needed.
3. **Cancel.**

Never auto-install.

### Phase 2 — Verify preconditions

Invoke `orc:verification-before-completion` (tests pass, lint clean). Then per repo:

```bash
git status --porcelain                              # must be empty
git rev-list --merges "$base"..HEAD                 # must be empty
n_commits=$(git rev-list --count "$base"..HEAD)     # must be ≥ 2
git rev-list "@{u}..HEAD" --count 2>/dev/null       # should be 0; warn if not
```

Any failure → surface the specific check + repo, stop. Don't try to "fix it for them."

If `n_commits == 1`, surface: "Single commit on the branch — there's nothing to stack. Use `/orc:ship`." and exit 0.

### Phase 3 — Analyze

**Default (commit-based):** validate every commit subject matches the Conventional Commits regex (per `orc:stack-pr` skill). On any miss, `AskUserQuestion`:

1. **Reword** — non-interactive subject rewrite, one prompt per commit.
2. **Switch to `--smart`** — agent doesn't care about subjects.
3. **Cancel.**

Build the slice list: one slice per commit. For each, compute `est_loc` from `git diff --shortstat <prev>...<this>` simulated by per-commit numstat sum.

**`--smart`:** dispatch agent.

```
Agent: orc-stack-analyzer
Inputs:
  branch:    <current_branch>
  base:      <base>
  budget:    <resolved_budget>
  repo:      <repo_name>           # workspace-only
  repoPath:  <repo_path>           # workspace-only
```

Read the returned JSON. If `unsplittable: true`, surface the agent's rationale and exit with the suggestion: "open big with reason via `/orc:ship`." Don't try to force a split.

### Phase 4 — Preview & confirm

Render the stack table:

```
Proposed stack (3 PRs from feat/export, base = origin/main)

| # | Branch                                       | Subject                                      | LOC | Commits |
|---|----------------------------------------------|----------------------------------------------|-----|---------|
| 1 | feat/export/01-refactor-extract-row-stream   | refactor: extract row-stream interface       |  80 | 2       |
| 2 | feat/export/02-feat-wire-export-job          | feat(api): wire export job through stream    | 140 | 1       |
| 3 | feat/export/03-feat-download-button          | feat(ui): download button + progress         |  95 | 1       |

Total: 315 LOC across 3 PRs (avg 105 LOC/PR, all under 300 budget).

[--smart only]
Warnings:
  - Commit e4f5g6h modifies one line in ExportJob.ts (slice 2). Proposed as-is.
```

`AskUserQuestion`:

1. **Approve** — execute the rebase plan.
2. **Edit** — open the slice JSON in `$EDITOR`; re-validate after save.
3. **Cancel.**

### Phase 5 — Execute

Backup before any reshape (non-negotiable):

```bash
git branch "${current_branch}-pre-stack-backup"
```

Apply the rebase plan. For each slice in order:

```bash
git checkout "$base_ref"
git checkout -b "$slice_branch"
for sha in "${cherry_pick[@]}"; do
  git cherry-pick --no-edit "$sha" || {
    echo "Cherry-pick of $sha failed."
    echo "Recover: git cherry-pick --abort && git reset --hard ${current_branch}-pre-stack-backup"
    exit 1
  }
done
```

Push and open PRs:

- **`gh-stack` path:**
  ```bash
  gs push                                   # pushes every layer
  gs submit --base "$base"                  # creates the chained PRs
  ```
  Capture each created URL via `gh pr list --json number,url,headRefName --limit $N` filtered to the new branch names.

- **plain-gh fallback:**
  ```bash
  for i in 1..N; do
    prev=$([ $i -eq 1 ] && echo "$base" || echo "$slice_branch_$((i-1))")
    git push -u origin "$slice_branch_$i"
    gh pr create --base "$prev" --head "$slice_branch_$i" \
      --title "[$i/$N] $subject_i" \
      --body "$body_placeholder_i" \
      ${ARG_DRAFT:+--draft}
  done
  ```

If any creation fails, print the recovery script (per `stack-pr` skill) and stop.

### Phase 6 — Two-pass body rewrite + metadata writeback

Once every PR exists, build the cross-link table (per `stack-pr` skill template) with all sibling URLs and rewrite each PR body via `gh pr edit <url> --body "$updated_body"`. The `(this)` marker shifts per PR.

Persist to `${ORC_STATE_DIR}/orc.json` — append per-PR entries to the active session's `linkedPRs[]`:

```bash
stackId="${SESSION_ID}-${REPO_NAME:-_}"      # workspace-aware
for i in 1..N; do
  jq --arg branch "$BRANCH" \
     --arg repo "${REPO_NAME:-_}" \
     --arg url "${pr_urls[$i]}" \
     --arg stackId "$stackId" \
     --argjson pos "$i" \
     --arg parent "$([ $i -eq 1 ] && echo '' || echo "${pr_urls[$((i-1))]}")" \
     '(.sessions[] | select(.branch == $branch) | .linkedPRs) += [{
        repo: $repo,
        url: $url,
        stackId: $stackId,
        stackPosition: $pos,
        stackedOn: (if $parent == "" then null else $parent end)
      }]' "$ORC_STATE_DIR/orc.json" > tmp && mv tmp "$ORC_STATE_DIR/orc.json"
done
```

If the active session does not yet exist (the user invoked `/orc:stack-pr` standalone, no prior `/orc:flow`/`/orc:ship`), create a minimal entry:

```json
{
  "session_id": "<ulid>",
  "command": "stack-pr",
  "branch": "<current_branch>",
  "branchSanitized": "<sanitized>",
  "scope": "repo|workspace",
  "status": "in_progress",
  "linkedPRs": [/* the entries above */],
  "current_phase": 6,
  "total_phases": 7,
  "created_at": "<utc>",
  "updated_at": "<utc>"
}
```

### Phase 7 — Reviewer hint + summary

Echo all PR URLs in stack order, then:

```
Stack created. Reviewers should:
  1. Read docs/STACKED-PRS.md (one screen) — explains merge order.
  2. Review and approve PR #1 first.
  3. Each subsequent PR includes only its incremental diff.

If you need to update a middle PR, push to its branch — orc will republish children automatically on the next /orc:address.

Backup branch: ${current_branch}-pre-stack-backup (delete with `git branch -D` once you trust the stack).
```

## When to invoke

- `/orc:ship` size gate fires → user picks "Stack it" → this command runs inline.
- After realizing mid-implementation that the branch grew past the budget — run standalone before opening the PR.
- Reviving a stale branch with multiple commits that should ship as separate PRs.

Don't invoke for branches with one commit, or for production hot-fixes where review-cycle time is the dominant cost (use `/orc:ship` with the `Size-budget-override:` trailer instead).

## Output

- N pushed branches (`<branch>/01-<slug>`, `<branch>/02-<slug>`, ...).
- N created PRs, chained, with cross-link tables in their bodies.
- A backup branch (`<branch>-pre-stack-backup`) preserving the original state.
- Updated `${ORC_STATE_DIR}/orc.json` with `linkedPRs[]` populated with stack metadata.
- A reviewer hint pointing at `docs/STACKED-PRS.md`.
