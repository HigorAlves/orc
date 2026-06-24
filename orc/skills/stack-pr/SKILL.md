---
name: stack-pr
description: "Use when breaking a too-big branch into a stack of smaller chained PRs — commit-based default, --smart agent-reshape, gh-stack detection, cross-links. Invoked by /orc:stack-pr and /orc:ship's size gate."
---

# Stack PR

## Overview

A stack is N chained PRs where each branch's base is the previous branch (not `main`). Reviewers approve incrementally, merging bottom-up. orc supports two construction strategies and one tool integration:

- **Strategy A — commit-based (default)** — every commit on the branch becomes one PR. Requires clean Conventional Commits.
- **Strategy B — smart (`--smart`)** — an analyzer agent reads the diff, proposes logical slices, and emits a non-interactive rebase plan. Higher risk, requires backup branch.
- **Tooling** — `github/gh-stack` `gh` extension if installed; otherwise a plain-`gh` fallback that does the same chaining manually.

**Announce at start:** "I'm using the stack-pr skill to construct a stacked PR group."

## Preconditions (both strategies)

1. **Tests pass** — invoke `orc:verification-before-completion` first.
2. **Clean working tree** — `git status --porcelain` must be empty.
3. **No merge commits** on `base..HEAD` — `git rev-list --merges base..HEAD` must be empty. Stacks fall apart through merges.
4. **At least 2 commits** on `base..HEAD`. A single commit isn't a stack — use `/orc:ship`.
5. **Branch is pushed-clean** — local matches `origin` (no unpushed work that the user might lose to the rebase).

If any precondition fails, surface a clear message and **stop**. Don't try to "fix it for them" — these are user decisions.

## Strategy A — commit-based (default)

### Validate Conventional Commits

Each commit subject MUST match:

```
^(feat|fix|refactor|chore|test|docs|perf|build|ci|style)(\([^)]+\))?!?: .+
```

If any commit fails the regex, surface the offenders and `AskUserQuestion`:

1. **Reword via reword-only rebase** — non-interactive (`GIT_SEQUENCE_EDITOR` writes a todo of `reword` lines; user is prompted for each subject one by one outside the rebase).
2. **Switch to `--smart`** — the analyzer agent doesn't care about commit subjects; it works from the diff.
3. **Cancel.**

### Build the stack

For each commit `Cᵢ` on `base..HEAD` in chronological order:

```bash
slug_i=$(echo "$subject" | sed 's/^[a-z]*([^)]*): *//' | tr ' ' '-' | tr -cd '[:alnum:]-' | tr A-Z a-z | cut -c1-40)
branch_i="${original_branch}/$(printf '%02d' $i)-${slug_i}"
```

Branch naming: zero-padded position keeps `git branch` output sortable. Suffix is the slugified subject — readable at a glance.

Reshape:

```bash
# Backup first (cheap, life-saving)
git branch "${original_branch}-pre-stack-backup"

# Reset to base, then replay commits onto sequentially-stacked branches
git checkout "$base"
git checkout -b "$branch_1"
git cherry-pick "$C1"
# C1 is now on branch_1 atop base

git checkout -b "$branch_2"   # branches off branch_1 (current HEAD)
git cherry-pick "$C2"
# ... and so on
```

The original branch is preserved as the backup. Caller may delete or keep it.

### Push & open PRs

If `gh-stack` is installed (see "Tooling detection"):

```bash
gs push                                          # pushes every layer
gs submit --base "$original_base"                # creates the chained PRs
```

Otherwise, plain-`gh` fallback (per-branch loop):

```bash
for i in 1..N; do
  prev_branch=$([ $i -eq 1 ] && echo "$original_base" || echo "$branch_$((i-1))")
  git push -u origin "$branch_$i"
  pr_url=$(gh pr create \
    --base "$prev_branch" \
    --head "$branch_$i" \
    --title "[$i/$N] $subject_i" \
    --body "$body_i_placeholder")
  echo "$pr_url" >> /tmp/orc-stack-urls.$$
done
```

### Two-pass body decoration

PR #1 cannot reference PR #2's URL at creation time (#2 doesn't exist yet). So all bodies are written with a placeholder, then rewritten in pass 2 once every URL is known:

```markdown
## Stacked PR ({i}/{N})

Stack: `{stackId}`
Merge bottom-up. See [docs/STACKED-PRS.md](../docs/STACKED-PRS.md).

| # | Subject | PR | Status |
|---|---------|----|--------|
| 1 | feat(api): add row stream  | org/api#311 | parent |
| 2 | feat(api): wire export job | org/api#312 | **this** |
| 3 | feat(ui): download button  | org/ui#447  | child |
```

Caveman variant (when `--caveman` is in scope):

```
## Stack ({i}/{N}, id: {stackId})
1 api#311 · 2 api#312 (this) · 3 ui#447
order: bottom-up
```

Update each PR via `gh pr edit <url> --body "<rewritten>"`.

### Metadata writeback

Append entries to the active session's `linkedPRs[]` in `${ORC_STATE_DIR}/orc.json`:

```json
{
  "repo": "api",
  "url": "https://github.com/acme/api/pull/311",
  "stackId": "<sessionId>-api",
  "stackPosition": 1,
  "stackedOn": null
}
```

`stackedOn` for position 1 is `null` (it's stacked on the base branch, not on another PR). For positions 2..N, it's the URL of position N-1.

`stackId = <sessionId>-<repo>` in workspace mode; `<sessionId>` alone in single-repo. Stable across reshape — re-stacking the same branch reuses the same `stackId`.

## Strategy B — `--smart`

Use when commits are messy (multiple WIP commits, fixups, no clean Conventional Commits) but the diff still has natural seams (refactor → schema → API → UI).

### Backup is non-negotiable

```bash
git branch "${original_branch}-pre-stack-backup"
```

The skill MUST refuse to proceed without this branch existing. Recovery is one command if anything fails:

```bash
git reset --hard "${original_branch}-pre-stack-backup"
```

The skill prints this line in red on any error.

### Dispatch the analyzer

```
Agent: orc-stack-analyzer
Inputs:
  branch:    <original_branch>
  base:      <base>
  diff:      `git diff base...HEAD`
  log:       `git log --reverse --format='%h %s%n%b' base..HEAD`
  numstat:   `git diff --numstat base...HEAD`
```

Expected JSON output (analyzer never runs anything destructive):

```json
{
  "slices": [
    {
      "position": 1,
      "name": "Refactor: extract row-stream interface",
      "rationale": "Pure refactor with no behavior change. Lands first to keep API slice small.",
      "files": ["api/src/stream/RowStream.ts", "api/src/stream/index.ts"],
      "est_loc": 80,
      "commits_to_include": ["a1b2c3d", "e4f5g6h"]
    },
    {
      "position": 2,
      "name": "feat: stream export job through new interface",
      "files": ["api/src/jobs/ExportJob.ts", "api/test/ExportJob.test.ts"],
      "est_loc": 140,
      "commits_to_include": ["i7j8k9l"]
    }
  ],
  "rebase_plan": [
    { "branch": "feat/x/01-refactor-extract-row-stream", "base_ref": "<base>", "cherry_pick": ["a1b2c3d", "e4f5g6h"] },
    { "branch": "feat/x/02-feat-stream-export-job",      "base_ref": "feat/x/01-refactor-extract-row-stream", "cherry_pick": ["i7j8k9l"] }
  ],
  "warnings": [
    "Commit `e4f5g6h` touches files in slice 2 — moving the slice-2 lines via interactive rebase is recommended."
  ]
}
```

### Preview & confirm

Render the slice table + warnings + rebase plan. `AskUserQuestion`:

1. **Apply** — execute the rebase plan exactly as proposed.
2. **Edit** — open the JSON in `$EDITOR` for manual tweaks; re-validate.
3. **Cancel.**

### Execute the rebase plan

For each entry in `rebase_plan`:

```bash
git checkout "$base_ref"
git checkout -b "$branch"
for sha in "${cherry_pick[@]}"; do
  git cherry-pick --no-edit "$sha" || {
    echo "Cherry-pick of $sha failed."
    echo "Recover: git cherry-pick --abort && git reset --hard ${original_branch}-pre-stack-backup"
    exit 1
  }
done
```

**Never** use `git rebase -i` — only the non-interactive composition above. The analyzer is responsible for ordering commits to minimize conflicts; on any conflict, abort and surface the recovery command.

After the reshape, push + open PRs identically to Strategy A (Pass 1, then Pass 2 body rewrite).

## Tooling detection

```bash
if command -v gh-stack >/dev/null 2>&1; then
  USE_GHSTACK=1
elif gh stack --help >/dev/null 2>&1; then
  # Installed as a gh extension; invoke via `gh stack` (or the `gs` alias if configured).
  USE_GHSTACK=1
  GHSTACK_CMD=(gh stack)
else
  USE_GHSTACK=0
fi
```

If absent, `AskUserQuestion`:

1. **Install** — `gh extension install github/gh-stack`. Run, then continue.
2. **Use plain-gh fallback** — chain via `gh pr create --base <prev-branch>`. No extension needed; works everywhere `gh` works.
3. **Cancel.**

**Never auto-install.** Tools that mutate the user's environment require explicit consent every time.

## Recovery (always print on error)

If any step fails after the backup branch exists, print exactly:

```
Stack construction failed at <step>.

To recover:
    git checkout "${original_branch}-pre-stack-backup"
    git branch -D "${original_branch}"
    git branch -m "${original_branch}-pre-stack-backup" "${original_branch}"
    # then delete any partial stack branches:
    git branch | grep "^  ${original_branch}/" | xargs -r git branch -D
```

Echo the partial state too: which branches were created, which PRs were opened. The user shouldn't have to dig through `git reflog` to figure out what happened.

## Workspace mode

Per-repo. Each repo's stack is independent. `stackId = <sessionId>-<repo>` keeps stacks segregated in `linkedPRs[]`. `/orc:cleanup` groups by `stackId` and enforces bottom-up ordering within each group.

## When NOT to stack

- **Single commit on the branch** — there's nothing to stack. Use `/orc:ship`.
- **Tightly-coupled changes** — if every commit references symbols defined in every other commit, splitting buys nothing because reviewers must read the whole stack to understand any one PR. Open big-with-reason instead.
- **Hot-fix in production-incident scope** — stacking adds review cycles. Open big-with-reason `Hot-fix incident #N` and rotate later.
- **Generated/vendored bulk** — auto-generated migrations, lockfile bumps, vendor updates. Excluded from LOC by default; gate won't fire.
