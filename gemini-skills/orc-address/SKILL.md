---
name: orc-address
description: Answer reviewer comments on YOUR open PR. Fetches unresolved comments, categorizes (ACTION/QUESTION/NITPICK/DISAGREE), dispatches code-fixer + reply-drafter in parallel, posts replies, pushes fixes. Workspace-aware — addresses all linked PRs together by default; --repo narrows.
---
# /orc:address

Address the reviewer feedback on your own PR. Closes the loop: code fixes + thread replies + push.

## Arguments

- `<pr-number>` — optional. If omitted, the command uses `gh pr list --head $(git branch --show-current)` to find the PR for the current branch.

## Workflow

### Phase 0 — Detect context

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

In workspace mode, identify the active workspace session and resolve the PR set:

- Read `${ORC_STATE_DIR}/orc.json`. Find the in-progress session whose `branch` matches the active branch (or whose `linkedPRs` includes the explicit `<pr-number>` if given).
- The default address target is **every URL in `linkedPRs`** (broadcast across all linked PRs of the workspace flow).
- `--repo <name>` narrows to one repo's PR; `--repos a,b` narrows to a subset. Iron rule: no silent broadcast — when no flag is given and `linkedPRs` has 2+ entries, prompt via `AskUserQuestion`: "Address comments on all N PRs / pick a subset / just one PR / cancel."

When run from inside a workspace-member repo (cwd is one of the children), follow the `workspace-link.json` back-pointer up to the workspace registry and proceed.

### Phase 1 — Fetch the PR(s) + unresolved comments

```
gh pr view <ref> --json number,title,headRefName,url,reviewThreads
gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate
```

In workspace mode, run both calls **per target PR** in parallel and bucket comments by repo (each comment carries the PR's repo name as its origin tag).

Filter to comments where the thread is unresolved. (If the reviewThreads JSON includes a `isResolved: false` flag, use it; otherwise treat all comments as unresolved unless the user says otherwise.)

### Phase 2 — Categorize

Read each comment + the surrounding code (`Read` the referenced file at the referenced line ±20 lines). Categorize:
- **ACTION** — reviewer is asking for a change.
- **QUESTION** — reviewer is asking why/what.
- **NITPICK** — style / preference.
- **DISAGREE** — reviewer's suggestion is wrong / incomplete.

Show the user the categorized list with `AskUserQuestion`:
- "Categories look right — proceed"
- "Re-categorize: <comment-id> should be <new-category>"

### Phase 3 — Dispatch in parallel

Two `Task` calls in the same response:

1. **`orc-code-fixer`** — pass the list of `ACTION` items with file/line/intended change. Agent applies edits, runs tests, returns a diff + test summary.
2. **`orc-reply-drafter`** — pass ALL comments (with categories + the diff from the code-fixer if available). Agent returns a JSON list of `{comment_id, reply}`.

**Workspace mode**: dispatch one `orc-code-fixer` per repo (parallel, single response, multiple `Task` calls), each with `repo`, `repoPath`, `siblingRepos`, and the ACTION items filtered to that repo's PR. Reply-drafter stays singular — pass ALL comments across ALL linked PRs at once so it can write coherent replies that reference cross-repo context where appropriate. The dispatcher merges per-repo fixer outputs before Phase 4.

### Phase 4 — Review the artifacts

Show the diff + drafted replies to the user via `AskUserQuestion`:
- "Looks good — commit, push, post replies"
- "Edit replies first" → re-prompt for which to edit
- "Edit fix first" → return to Phase 3 with adjusted fix list

### Phase 5 — Commit + push + post

1. Invoke `orc:git-commit` to commit fixes with a Conventional Commit message (e.g. `fix: address PR review feedback`).
2. `git push`.
3. For each reply: `gh api repos/{owner}/{repo}/pulls/{n}/comments/{comment-id}/replies -f body="..."`.
4. Optionally re-request review: `gh pr edit <ref> --add-reviewer <reviewer>`.

In workspace mode, run steps 1–2 **per repo** with fixes (cd into each repo's worktree first); steps 3–4 run per linked PR. Each repo gets its own commit and push; threads on each PR get their inline replies routed to that PR's `{owner}/{repo}` path.

**Inline replies only. Never post a top-level PR comment summarizing what was addressed.** The inline reply on each thread already says what changed; a recap comment duplicates that signal and clutters the PR conversation. Specifically: do NOT call `gh pr comment`, do NOT call `gh api repos/{owner}/{repo}/issues/{n}/comments`, do NOT post any standalone "Addressed in <sha>:" rollup. One reply per thread, posted via the `/pulls/{n}/comments/{id}/replies` endpoint above. Nothing else.

### Phase 6 — Confirm

Echo the result: number of comments addressed, fix commit SHA, replies posted.

## Iron rules

1. Never post a reply that has not been shown to the user first. The user is the engineer of record on every PR thread.
2. Inline replies only. No top-level recap PR comment. (See Phase 5.)

## Output

- New commit on the PR branch with the fixes
- Posted replies on the PR threads
- (No `.orc/` writes — interaction is logged in GitHub itself.)
