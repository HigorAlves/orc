# Posting backends — gh api and GitHub MCP

Disclosed from `orc:inline-review`. Read when building the review payload: the atomic `gh api` POST (default), the 3-call GitHub MCP protocol, and the selection logic.

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
