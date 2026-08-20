---
description: Answer reviewer comments on YOUR open PR — categorize unresolved threads, push fixes, and post replies. Workspace-aware across linked PRs.
argument-hint: "[--auto[=guided|full]] [<pr-number>] [--repo <name>] [--repos a,b]  (omitted = current branch's PR / all linked PRs)"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh pr view:*)
  - Bash(gh pr list:*)
  - Bash(gh pr checks:*)
  - Bash(gh run:*)
  - Bash(gh api:*)
  - Bash(git:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:address

Address the reviewer feedback on your own PR. Closes the loop: code fixes + thread replies + push.

## Arguments

- `--auto[=guided|full]` — autopilot level for this run (overrides `interaction_policy`; taxonomy in `orc:using-orc`). Soft-inward gates consult the resolved policy — `guided` auto-advances mechanical confirms with a printed one-liner; `full` pre-approves them from settled decisions (`orc:state-protocol`), stopping only on escalation-only conditions. Hard-outward gates are unaffected at every level.

- `<pr-number>` — optional. If omitted, the command uses `gh pr list --head $(git branch --show-current)` to find the PR for the current branch.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection).

In workspace mode, identify the active workspace session and resolve the PR set:

- `orc-state get --field linkedPRs` for the active branch's session (read-for-data per `orc:state-protocol`; when an explicit `<pr-number>` is given, `orc-state sessions` rows locate the session whose `linkedPRs` includes it).
- The default address target is **every URL in `linkedPRs`** (broadcast across all linked PRs of the workspace flow).
- `--repo <name>` narrows to one repo's PR; `--repos a,b` narrows to a subset. Iron rule: no silent broadcast — when no flag is given and `linkedPRs` has 2+ entries, prompt via `AskUserQuestion`: "Address comments on all N PRs / pick a subset / just one PR / cancel."

When run from inside a workspace-member repo (cwd is one of the children), follow the `workspace-link.json` back-pointer up to the workspace registry and proceed.

### Phase 1 — Fetch the PR(s) + unresolved comments

```
gh pr view <ref> --json number,title,headRefName,url,reviewThreads
gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate
```

In workspace mode, run both calls **per target PR** in parallel and bucket comments by repo (each comment carries the PR's repo name as its origin tag).

Also fetch check state per target PR: `gh pr checks <ref>`. Any failing check → flag the PR as **red-CI** for Phase 3 (the fix batch will fold in CI fixes alongside the review fixes).

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

**Red-CI pre-step (only when Phase 1 flagged failing checks):** dispatch `orc-ci-investigator` via `Task` first — pass the PR ref and head SHA. It returns a classified diagnosis with a fix list. Fold every `fixable` item into the ACTION list below (tagged `origin: ci` so the commit message and replies can distinguish them); `flake`/`infra`/`needs-debug` verdicts are NOT folded in — surface them in Phase 4 with the evidence so the user decides (re-run, escalate, or `/orc:debug`) alongside the review pass.

Then two `Task` calls in the same response:

1. **`orc-code-fixer`** — pass the list of `ACTION` items (review comments + any folded-in CI fix items) with file/line/intended change. Agent applies edits, runs tests, returns a diff + test summary.
2. **`orc-reply-drafter`** — pass ALL comments (with categories + the diff from the code-fixer if available). Agent returns a JSON list of `{comment_id, reply}`. CI fix items get no replies — they have no thread; they ride the same fix commit.

**Workspace mode**: dispatch one `orc-code-fixer` per repo (parallel, single response, multiple `Task` calls), each with `repo`, `repoPath`, `siblingRepos`, and the ACTION items filtered to that repo's PR. Reply-drafter stays singular — pass ALL comments across ALL linked PRs at once so it can write coherent replies that reference cross-repo context where appropriate. The dispatcher merges per-repo fixer outputs before Phase 4.

### Phase 4 — Review the artifacts

(Hard-outward per `orc:using-orc` — this gate posts replies to reviewers' threads; `--auto`/`interaction_policy` never skip it. Iron rule 1 below stands at every level.)

Show the diff + the drafted replies (numbered) — then ONE `AskUserQuestion` call:

1. **Fixes + replies?**
   - "Looks good — commit, push, post replies"
   - "Edit fix first" → return to Phase 3 with adjusted fix list
   - "Abort"
2. **Drop or rewrite any replies?** (`multiSelect`; chunks of 4 replies per question when more than 4 exist, up to 3 chunks in the same call) — default keep all; select numbers to drop; rewrites via the free-text Other as `<n>: <new text>`. Edited replies re-render in a final preview with the same question 1 before anything posts.

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
