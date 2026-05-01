---
description: Answer reviewer comments on YOUR open PR. Fetches unresolved comments, categorizes (ACTION/QUESTION/NITPICK/DISAGREE), dispatches code-fixer + reply-drafter in parallel, posts replies, pushes fixes.
argument-hint: "[<pr-number>]  (omitted = current branch's PR)"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh pr view:*)
  - Bash(gh pr list:*)
  - Bash(gh api:*)
  - Bash(git *)
  - Bash(npm *:*)
  - Bash(pnpm *:*)
  - Bash(yarn *:*)
---

# /orc:address

Address the reviewer feedback on your own PR. Closes the loop: code fixes + thread replies + push.

## Arguments

- `<pr-number>` — optional. If omitted, the command uses `gh pr list --head $(git branch --show-current)` to find the PR for the current branch.

## Workflow

### Phase 1 — Fetch the PR + unresolved comments

```
gh pr view <ref> --json number,title,headRefName,url,reviewThreads
gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate
```

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

### Phase 6 — Confirm

Echo the result: number of comments addressed, fix commit SHA, replies posted.

## Iron rule

Never post a reply that has not been shown to the user first. The user is the engineer of record on every PR thread.

## Output

- New commit on the PR branch with the fixes
- Posted replies on the PR threads
- (No `.orc/` writes — interaction is logged in GitHub itself.)
