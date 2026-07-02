---
name: inline-review
description: Post a real GitHub PR review with inline comments anchored to lines, plus optional one-click suggestions. Use when posting line-level PR feedback; invoked by /orc:code-review after findings.
---

# Inline GitHub PR Review

Convert a list of structured findings (from `orc-pr-reviewer` and/or `orc-security-reviewer`) into a real GitHub PR review — inline comments anchored to specific files and lines, optional one-click apply suggestion blocks, and a review event (APPROVE / COMMENT / REQUEST_CHANGES) computed mechanically from finding severities.

This skill replaces the legacy text-block summary format. The reviewed author opens the PR and sees comments pinned next to the actual code, not a markdown wall they have to manually navigate.

## When to use

- Inside `/orc:code-review` Phase 5–7 after merging findings from agents.
- Anywhere else you need to post a structured PR review programmatically.

## When NOT to use

- For top-level PR comments without line anchors → use `gh pr comment`.
- For replying to an existing review comment → use the replies endpoint (`gh api repos/.../pulls/.../comments/<id>/replies`); see `orc:receiving-code-review`.
- For your OWN PR's response loop → use `/orc:address`, not this skill.

## The severity → event rule (the iron rule)

Every finding has a `severity` enum. The review event is computed from the **set** of severities — the agent's own narrative verdict is ignored. This prevents the failure mode where an agent writes *"Approve, non-blocking"* immediately followed by a list of real bugs.

| Severity | Meaning | Effect |
|----------|---------|--------|
| `bug` | Real correctness problem in code that lands on this PR — runtime error, logic error, race, regression risk. | **Forces REQUEST_CHANGES.** One is enough. |
| `security` | Auth bypass, injection, secret leak, unsafe deserialization, SSRF, etc. | **Forces REQUEST_CHANGES.** One is enough. |
| `api-surface` | Wrongly exposed endpoint, dead code paths in public surface, breaking API change. | **Forces REQUEST_CHANGES.** |
| `test` | Real test gap on the changed surface (untested branch, missing assertion, fail-open). | **Forces REQUEST_CHANGES** by default; `--soft-tests` relaxes to COMMENT. |
| `nit` | Pure style/naming/formatting the linter doesn't catch. | COMMENT only. Never blocks. |
| `suggestion` | Refactor / improvement opportunity, no correctness concern. | COMMENT only. |
| `question` | Reviewer not sure if it's a bug — asking the author to confirm. | COMMENT only. |

### Event computation algorithm

```
def compute_event(findings, soft_tests=False):
    severities = {f.severity for f in findings}
    blocking = {"bug", "security", "api-surface"}
    if not findings:
        return "APPROVE"
    if severities & blocking:
        return "REQUEST_CHANGES"
    if "test" in severities and not soft_tests:
        return "REQUEST_CHANGES"
    return "COMMENT"
```

### Self-contradiction detection (mandatory)

If the agent's `summary` text contains any of `["approve", "lgtm", "looks good", "no concerns", "non-blocking"]` AND any finding has severity in `{bug, security, api-surface}`, surface a warning to the user before posting:

```markdown
> [!WARNING]
> **⚠️ Caution**
>
> Reviewer wrote "Approve" but flagged 2 bug-severity findings. Severity rule overrides verdict — posting as REQUEST_CHANGES.
```

Then proceed with the computed REQUEST_CHANGES. Do not let the contradiction ship.

## Finding schema

Agents (orc-pr-reviewer, orc-security-reviewer) return findings in this shape:

```json
{
  "summary": "One-paragraph framing of the PR. Informational only — does NOT decide the event.",
  "findings": [
    {
      "path": "src/auth.ts",
      "line": 42,
      "start_line": null,
      "side": "RIGHT",
      "severity": "bug",
      "title": "Null deref when token absent",
      "body": "When `req.headers.authorization` is missing, `parseToken()` returns null and the next line dereferences `.userId` unconditionally — 500 to client, no log.",
      "suggestion_code": "const token = parseToken(req);\nif (!token) return res.status(401).end();",
      "confidence": 0.92
    }
  ]
}
```

**Required:** `path`, `line`, `severity`, `title`, `body`, `confidence`. **Optional:** `start_line` (multi-line spans), `suggestion_code` (small concrete fix; see suggestion block rules).

## Line-number semantics

- `path` — repo-relative POSIX path (e.g. `src/api/users.ts`). NOT a URL, NOT prefixed with `a/` or `b/`.
- `line` — line number in the **NEW** file (post-change). NOT the diff hunk offset, NOT the line in the old file. Agents must compute this from the diff hunk header `@@ -OLD_START,OLD_COUNT +NEW_START,NEW_COUNT @@` plus the offset of the matched line within the hunk.
- `start_line` — for multi-line spans (e.g. a problem spanning lines 45–47), set `start_line: 45, line: 47`. Single-line findings leave `start_line: null` (or omit the key).
- `side` — always `"RIGHT"` (the new/added side of the diff). `"LEFT"` is for comments on removed code, almost never useful for review findings.

## Posting backend selection

Two paths produce identical end-result on GitHub. The orchestrator picks at runtime.

### Default: `gh api` (atomic batched POST)

One call posts everything atomically (all comments + overall body + event). Requires only `gh` CLI authenticated — already in orc's tool-check.

```bash
gh api repos/${OWNER}/${REPO}/pulls/${PR}/reviews \
  --method POST \
  --input - <<EOF
{
  "event": "REQUEST_CHANGES",
  "body": "Overall framing paragraph for the review.",
  "comments": [
    {
      "path": "src/auth.ts",
      "line": 42,
      "side": "RIGHT",
      "body": "null deref when token absent — guard with early return.\n\n\`\`\`suggestion\nconst token = parseToken(req);\nif (!token) return res.status(401).end();\n\`\`\`"
    },
    {
      "path": "src/api.ts",
      "start_line": 118,
      "line": 120,
      "side": "RIGHT",
      "body": "user input flows into raw SQL — parameterize via \`$1\`/\`$2\`."
    }
  ]
}
EOF
```

Capture the returned review URL from `.html_url` for echoing to the user.

### Fallback: GitHub MCP (3-call protocol)

When `mcp__plugin_github_github__pull_request_review_write` is available in the session (i.e. the user has the official GitHub MCP plugin installed), prefer it — per-comment dispatch can be more flexible if a future iteration wants per-comment validation.

```
Call 1 — create pending review (no event, holds empty body):
  mcp__plugin_github_github__pull_request_review_write
    method: "create"
    owner: <owner>, repo: <repo>, pullNumber: <pr>

Call 2 — loop, once per finding:
  mcp__plugin_github_github__add_comment_to_pending_review
    subjectType: "LINE"
    path: <path>
    line: <line>
    side: "RIGHT"
    startLine: <start_line> | omit
    body: <body with optional suggestion block>

Call 3 — submit pending with overall body + event:
  mcp__plugin_github_github__pull_request_review_write
    method: "submit_pending"
    event: "REQUEST_CHANGES" | "COMMENT" | "APPROVE"
    body: <overall framing paragraph>
```

The orchestrator's selection logic:

```
if "mcp__plugin_github_github__pull_request_review_write" in available_tools:
    use_mcp_path()
else:
    use_gh_api_path()
```

## Suggestion block rules

GitHub renders a triple-backtick `suggestion` block inside a comment body as a one-click "Apply suggestion" button. Use sparingly:

- **Length:** ≤ 6 lines of code. Longer suggestions are usually refactors disguised as fixes — describe in prose instead.
- **Completeness:** Committing the suggestion must FULLY resolve the issue. No partial fixes that leave the author guessing.
- **Mental compile:** The suggested code must be syntactically valid in the target language and reference only symbols visible at the comment's line. No imports the author has to add separately.
- **No refactor smuggling:** Don't suggest renames, file moves, or stylistic rewrites as committable suggestions. Those go in prose.

Format inside the comment `body`:

````
Brief prose description of the problem.

```suggestion
const token = parseToken(req);
if (!token) return res.status(401).end();
```

Optional follow-up prose (caveat, edge case, etc.).
````

If `suggestion_code` is set on a finding but doesn't meet the rules above, drop it from the suggestion block and keep the prose only.

## The preview gate (mandatory)

Before posting, ALWAYS show the user the constructed payload. No `--no-confirm` flag. Open with a `[!NOTE]` `**📋 Preview — review for #<PR>**` headline (per the `orc:insights` palette); the aligned comment list goes in a fence after it. The preview lists:

- The computed event (`APPROVE` / `COMMENT` / `REQUEST_CHANGES`)
- The overall body (≤ 2 sentences — see the cap below)
- One line per comment: `<path>:<line> [severity] <title>`
- Total comment count
- Any self-contradiction warnings (see severity-event rule above)

Then `AskUserQuestion`:
- `Post the review as shown`
- `Edit / drop specific comments` — loop back to drop or rewrite individual entries
- `Switch to summary-only mode` — fall back to text-block markdown, do not post
- `Cancel` — exit without posting; echo the constructed payload as JSON for the user to copy

This is the single most important UX rule. Auto-posting reviews is a trust-eroding move; the gate is cheap and catches mistakes at zero cost.

## Iron rules

1. **Severity-event mapping is computed mechanically.** Agents do NOT decide the event. The posting layer overrides any agent verdict that contradicts its own findings.
2. **Max 15 inline comments per review.** Over-commenting erodes signal. If agents return > 15, surface the count and ask the user which to drop before posting.
3. **Suggestion blocks ONLY when they meet all three rules** (length, completeness, mental compile). Don't smuggle refactors.
4. **Preview gate is mandatory.** No flag bypasses it.
5. **Comments are posted on lines the author actually modified in this PR.** Pre-existing bugs not touched by the diff get dropped at the agent layer (caveman-review rule); if any slip through, the orchestrator filters them by checking each `path:line` is in the diff before posting.
6. **No AI attribution in the review body or comments.** Same rule as everywhere else in orc — the comments speak for themselves.

## Tone

The comment body should follow `orc:caveman-review` discipline — terse, actionable, signal-only. The overall review body is hard-capped at **2 sentences (~40 words)**: one clause framing the PR + finding counts by severity (e.g. "CSV export for /reports. 2 bugs, 1 untested branch, 2 nits."). It never restates inline comments, never praises, never hedges — the inline comments carry all detail. No throat-clearing, no praise per finding. One line per problem in the comment body, suggestion block underneath if applicable.

## Comment-body templates

### Bug with concrete fix (suggestion block fits)

````
Null deref when `req.headers.authorization` is missing — `parseToken()` returns null and the next line accesses `.userId` unconditionally. 500 to client, no log.

```suggestion
const token = parseToken(req);
if (!token) return res.status(401).end();
```
````

### Bug without concrete fix (prose only)

```
Race condition: `cycleParticipants.id` is read in line 507 then mutated in line 512 by a concurrent worker. The intermediate state can leak into the cycleDetails projection. Either lock the row in the outer transaction or refetch after mutation.
```

### Test gap (no suggestion possible)

```
`evaluateeAllowedByStepFilter` has no test for `participants: []` (array, not object). `typeof [] === 'object'` passes the guard; `p.blacklistedUsers` is undefined; `safeIds(undefined)` returns []; the filter silently allows everyone. Add a test case with `participants: []` to pin the fail-open behavior, OR add an `Array.isArray(p)` guard.
```

### Question (low confidence, asking author)

```
q: This new `getWorkflowOverview` endpoint duplicates the admin router's. Is the intent to migrate one to the other, or are they meant to diverge? If the latter, worth a comment explaining the split.
```

## Getting help

```bash
# Inspect what the gh api invocation will look like (dry-run alternative)
echo "$PAYLOAD_JSON" | jq .

# After posting, fetch the posted review for verification
gh api repos/${OWNER}/${REPO}/pulls/${PR}/reviews/${REVIEW_ID}

# List all reviews on a PR
gh pr view ${PR} --json reviews
```

## References

- GitHub REST API — Reviews: https://docs.github.com/en/rest/pulls/reviews
- Suggestion block format: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/incorporating-feedback-in-your-pull-request#applying-suggested-changes
- Sibling skills: `orc:gh-cli` (the gh CLI / API surface), `orc:caveman-review` (tone discipline that comment bodies should follow).
