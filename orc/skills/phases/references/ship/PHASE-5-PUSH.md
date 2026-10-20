<!-- orc:ship/P5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 5 — Push + create PR

> **🛑 Outward write**
>
> Steps 1–2 push and open the PR. Step 4 posts a PR comment only after the `orc:evidence-publish` answer.

1. Run `git push -u origin <branch>`.
2. Run `gh pr create --title "<title>" --body "<body>" [--draft] [--base <base>]`.
3. Echo the PR URL.
4. If the QA manifest below exists, invoke `orc:evidence-publish` with the inputs below.
5. In workspace mode, run the two-pass loop below instead of steps 1–3.

QA manifest: `${ORC_STATE_DIR}/<sanitized-branch>/files/qa/qa-manifest.json`. Inputs: `qaDir`, the packet's `verdict`, the new PR. Its PR-comment question (hard-outward, header `Post`) offers the verdict table and links on the PR just opened. Keep-local is the default; nothing posts without the answer.

## Workspace mode: two-pass loop

Pass 1 — push + create per repo, sequential so `gh pr create` observes a clean push:

6. Skip any repo whose orc:ship/P4.5 produced a stack; its `linkedPRs[]` entries already exist.
7. For each remaining repo, push and create with the loop below.
8. Append each new PR to `linkedPRs` in `orc.json` (the `jq` in the loop).

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

Pass 2 — inject the reciprocal "Linked PRs" block, after all PRs exist:

9. For each PR, run `gh pr edit <url> --body "$(updated body)"` with the block appended.
10. Source the merge order from the plan's "Merge order" line; omit it if absent.
11. Echo all N PR URLs to the user.

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

NOTE: PR #1 does not know PR #2's number at creation time, hence the second pass. For a stacked repo, `gh pr create` would create a duplicate, hence step 6.
