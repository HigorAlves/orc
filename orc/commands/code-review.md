---
description: Review someone else's open GitHub PR end-to-end via gh CLI. Posts a real GitHub PR review with inline comments anchored to specific lines and (when applicable) one-click suggestion blocks. Review event (APPROVE / COMMENT / REQUEST_CHANGES) computed mechanically from finding severities — agents do NOT decide the verdict. Mandatory preview gate before posting. Workspace-aware — accepts multiple PR refs to review a set of linked PRs as one logical change.
argument-hint: "<pr-number-or-url> [--prs a#1,b#2,...] [--context <description>] [--summary-only] [--soft-tests] [--dry-run] [--include-nits]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr list:*)
  - Bash(gh api:*)
  - Bash(gh api repos:*/pulls:*/reviews:*)
  - Bash(jq *)
  - Bash(. */lib/workspace-detect.sh*)
---

# /orc:code-review

Review a pull request authored by someone else. Default behavior: post a real GitHub PR review with inline comments anchored to the right files and lines, optional one-click suggestion blocks, and a review event determined mechanically from finding severities.

The agents (`orc-pr-reviewer`, `orc-security-reviewer`) return structured JSON findings. This command merges them, sanity-checks for verdict-vs-severity contradictions, shows a preview, and posts via `gh api` (or the GitHub MCP if available).

## Arguments

- `<pr-number-or-url>` — required (unless `--prs` is given). Either `123` (current repo), `org/repo#123`, or a full URL.
- `--prs a#1,b#2,...` — workspace mode: review a **set** of linked PRs as one logical change. Each entry is `repo#pr` or full URL. Findings are tagged with `[repo:<name>]` and the merge order from the workspace plan is surfaced in the summary. Mutually exclusive with the positional `<pr-number-or-url>`.
- `--context <description>` — optional. Describes what the PR is supposed to accomplish, used for requirements-alignment checks.
- `--summary-only` — produce the legacy text-block markdown summary instead of posting inline. For when you want markdown to paste elsewhere or don't want to auto-post. Skips Phases 5–7.
- `--soft-tests` — `test`-severity findings drop to COMMENT instead of forcing REQUEST_CHANGES. Use for repos with weak test culture or PRs you explicitly want to land despite test gaps.
- `--dry-run` — runs through Phase 6 (preview) but never posts. The constructed payload is echoed as JSON for inspection. Useful for testing or for reviews you want to inspect locally before deciding.
- `--include-nits` — keep `nit`-severity findings (default: drop them). Bumps comment count but doesn't change the event.

## Workflow

### Phase 0 — Detect context

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/workspace-detect.sh"
eval "$(orc_detect_context)"
```

If `--prs` is given OR the workspace registry has an in-progress session whose `linkedPRs` matches the positional ref, the review is **multi-PR**. In multi-PR mode:

- Resolve the full PR set (either from `--prs` or from the matching session's `linkedPRs`).
- Each PR is reviewed in parallel by its own `orc-pr-reviewer` instance (one `Task` call per PR), each with `repo` + `repoPath` inputs.
- Findings are merged across PRs and tagged `[repo:<name>]` at the top of each comment body.
- The Phase 5 summary names every PR and surfaces merge order from the workspace plan ("Merge order: api → ui (per workspace plan)").
- Phase 7 posts to **each** PR independently — every repo gets its own review event computed from the slice of findings tagged for that repo. **Cross-repo findings** (where one PR's bug requires fixing another) are surfaced via comments on both PRs referencing each other.

If `--prs` is not given and no matching workspace session is found, this command behaves as today (single-PR review).

### Phase 1 — Eligibility check

```bash
gh pr view <ref> --json state,isDraft,reviewDecision,author,title,additions,deletions,changedFiles
```

- If `state` is `CLOSED` or `MERGED`, stop and report.
- If `isDraft` is true, ask via `AskUserQuestion` whether to review anyway (sometimes drafts are explicitly opened for early feedback).
- If `reviewDecision` shows you've already reviewed, stop and report unless user opts to re-review.

### Phase 2 — Diff fetch + project guidelines

```bash
gh pr diff <ref> > /tmp/pr-<ref>.diff
```

`Glob` the repo for `CLAUDE.md` files (root + scoped to changed directories). Read them. Reviewer agents will use them as project-specific style/architecture rules.

### Phase 3 — Parallel agent dispatch

Always dispatch `orc-pr-reviewer` (generalist). Additionally dispatch `orc-security-reviewer` **in parallel** when the diff touches security-sensitive paths — auto-detect via heuristic on the changed files:

```
auth/* | session* | login* | password* | token* | jwt* | crypto*
api/* | routes/* | middleware/*
*.sql | migrations/* | db/*
upload* | file* | parser*
deserializ* | exec | eval
package*.json | requirements.txt | go.mod | Cargo.toml  (dependency surface)
```

If any changed file matches, the parallel dispatch applies. Otherwise just `orc-pr-reviewer`. (Override via `AskUserQuestion`: "force security review" / "skip security review" / "auto".)

Each agent gets:
- The PR ref.
- The full diff path.
- Any CLAUDE.md guideline content found.
- Any `--context` text.

**Output contract:** Both agents return strict JSON per the schema in `orc:inline-review`:

```json
{
  "summary": "...",
  "findings": [{ "path": ..., "line": ..., "severity": ..., "title": ..., "body": ..., "suggestion_code": ..., "confidence": ... }]
}
```

### Phase 4 — Merge + sanity check

1. **Concatenate** findings arrays from both agents into one list.
2. **Sort** by `(severity-priority desc, path asc, line asc)` — bugs/security/api-surface first, then test, then suggestion/question, then nit. Within severity, by file path then line.
3. **Filter** if `--include-nits` not passed: drop all `nit`-severity findings.
4. **Validate** each finding:
   - `path` exists in the diff (drop comments on lines the author didn't modify — caveman-review rule).
   - `confidence` ≥ 0.8 (drop low-confidence findings; agents shouldn't return them, but enforce here).
5. **Self-contradiction detection.** For each agent's `summary`, scan for the strings `["approve", "lgtm", "looks good", "no concerns", "non-blocking"]` (case-insensitive). If matched AND any finding from that agent has severity in `{bug, security, api-surface}` → record a warning to surface in the preview.
6. **Compute the event** mechanically per the `orc:inline-review` rule:
   ```
   blocking = {"bug", "security", "api-surface"}
   if not findings:                                            event = "APPROVE"
   elif any(f.severity in blocking for f in findings):         event = "REQUEST_CHANGES"
   elif any(f.severity == "test" for f in findings) and not soft_tests:  event = "REQUEST_CHANGES"
   else:                                                       event = "COMMENT"
   ```

### Phase 5 — Compose the review

Invoke `orc:inline-review`. Build:

- **Overall body** (1 paragraph): a brief framing of the PR + a one-line summary per finding category. Example:
  > "Adds CSV export for /reports endpoint. 2 bugs flagged in the serialization path, 1 untested branch in the API layer, plus a couple of nits."
- **Comments[]**: one per finding, per the `orc:inline-review` schema:
  - `path`, `line`, `start_line?`, `side: "RIGHT"`
  - `body`: the finding's `body` (caveman-review tone), with the suggestion block appended if `suggestion_code` is set and meets the suggestion-block rules from `orc:inline-review`.

**Cap at 15 comments.** If the merged + filtered list exceeds 15:

```
AskUserQuestion: "20 findings exceed the 15-comment cap. Pick which to drop:"
- Drop all nits, then take top 15 by severity-priority
- Show me the full list — let me pick
- Cancel
```

### Phase 6 — Preview gate (mandatory)

Show the user the constructed payload before posting. No `--no-confirm` flag bypasses this. Format:

```
─────────────────────────────────────────────────────────
Review for #<PR>: <title>
Computed event: <APPROVE | COMMENT | REQUEST_CHANGES>

Overall body:
  <body, 1 paragraph>

Comments (<count>):
  <path>:<line>            [bug]      Null deref when token absent
  <path>:<line>-<line>     [security] IDOR — unauthenticated /users/:id
  <path>:<line>            [test]     Refund partial-amount branch untested
  ...

⚠ Warnings:
  - orc-pr-reviewer summary said "approve" but flagged 2 bug findings.
    Severity rule overrides verdict — posting as REQUEST_CHANGES.
─────────────────────────────────────────────────────────
```

Then `AskUserQuestion`:

- `Post the review as shown`
- `Edit / drop specific comments` — loop into a per-comment `AskUserQuestion`: keep / drop / rewrite, then loop back to Phase 6 with the trimmed list
- `Switch to summary-only mode` — fall through to Phase 8 (legacy text-block) and don't post inline
- `Cancel` — exit cleanly; echo the constructed payload as JSON for the user to copy

If `--dry-run` was passed: echo the payload as JSON and exit. Skip posting.

### Phase 7 — Post

If GitHub MCP detected (`mcp__plugin_github_github__pull_request_review_write` available in tools):

```
1. mcp__plugin_github_github__pull_request_review_write
     method: "create"
     owner, repo, pullNumber
2. (loop per comment) mcp__plugin_github_github__add_comment_to_pending_review
     subjectType: "LINE", path, line, side: "RIGHT", startLine?, body
3. mcp__plugin_github_github__pull_request_review_write
     method: "submit_pending"
     event: <computed>
     body: <overall body>
```

Otherwise (default):

```bash
PAYLOAD=$(jq -n --argjson comments "$COMMENTS_JSON" \
                --arg event "$EVENT" \
                --arg body "$BODY" \
                '{event: $event, body: $body, comments: $comments}')

echo "$PAYLOAD" | gh api repos/${OWNER}/${REPO}/pulls/${PR}/reviews \
  --method POST \
  --input - \
  --jq '.html_url'
```

Echo the returned review URL.

### Phase 8 — Summary-only fallback (legacy text-block)

Reached only when `--summary-only` was passed or the user picked "Switch to summary-only mode" at the preview gate. Build a markdown summary grouped by severity:

```markdown
## Bugs
- src/auth.ts:42 — null deref when token absent — guard with `?.` or early return

## Security
- src/api.ts:120 — user input flows into raw SQL — parameterize with `$1`/`$2`

## Tests
- src/billing.ts:55–80 — refund partial-amount branch untested
```

Echo to the user. No GitHub posting happens in this branch.

## Output

- A real GitHub PR review with inline comments + computed event (default), OR
- A markdown summary echoed to the user (`--summary-only` or fallback)
- Review URL echoed (when posted)
- (No `.orc/` writes — code review is stateless from orc's perspective.)

## Tone discipline (handed to the agents)

Defer to `orc:caveman-review` for tone — terse, signal-only, one finding per comment, no praise. Comment bodies follow that style. The overall body (Phase 5) gets one extra sentence of framing but stays short.

## Iron rules

- **Severity-event mapping is computed mechanically.** Agents do NOT decide the event. Phase 4 sanity-check overrides any agent verdict that contradicts its own findings.
- **Preview gate is mandatory.** No flag bypasses it.
- **Max 15 inline comments.** Surface the cap and ask the user to drop overflow.
- **Comments only on lines the author modified in this PR.** Pre-existing bugs not touched by the diff get filtered out at Phase 4.
- **Suggestion blocks per the `orc:inline-review` rules** (≤ 6 lines, fully resolves issue, syntactically valid). Don't smuggle refactors.
- **No AI attribution in the review body or any comment.**
