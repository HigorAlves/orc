<!-- orc:code-review/P6 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 6 — Preview gate, then post

> **🛑 Outward write**
>
> Step 4 posts to GitHub. Steps 1–3 are the hard-outward gate; no flag or autopilot level skips them.

1. Print the preview callout, then the aligned payload in a fence.
2. If P4 recorded a Caution, print it as a separate `⚠️ Caution` callout.
3. Ask with `AskUserQuestion`, header `Post`, the payload as the `preview` of the first option.
4. On "Post", send the review by the backend below and echo the returned URL.
5. If `--dry-run`, print the payload as JSON and stop before step 4.
6. In multi-PR mode, repeat steps 1–4 per PR with that PR's findings and event.

Preview callout:

```markdown
> **📋 Preview — review for #<PR>: <title>**
>
> Computed event: **<APPROVE | COMMENT | REQUEST_CHANGES>** · <count> inline comments.
```

```
Overall body:
  <body>

Comments (<count>):
  <path>:<line>            [bug]      Null deref when token absent
  <path>:<line>-<line>     [security] IDOR — unauthenticated /users/:id
```

Options (`orc:gates` §3):

- Post the review as shown.
- Edit or drop specific comments — one `AskUserQuestion` call, up to four `multiSelect` chunks of four; rewrites ride the notes as `<n>: <new text>`. Then return to step 1 once.
- Switch to summary-only — Read `orc:code-review/P8`.
- Cancel — print the payload as JSON.

Backend, GitHub MCP when `mcp__plugin_github_github__pull_request_review_write` is available:

```
1. pull_request_review_write  method: "create"  owner, repo, pullNumber
2. add_comment_to_pending_review per comment  subjectType: "LINE", path, line, side: "RIGHT", startLine?, body
3. pull_request_review_write  method: "submit_pending"  event, body
```

Backend, default:

```bash
PAYLOAD=$(jq -n --argjson comments "$COMMENTS_JSON" --arg event "$EVENT" --arg body "$BODY" \
  '{event: $event, body: $body, comments: $comments}')
echo "$PAYLOAD" | gh api "repos/${OWNER}/${REPO}/pulls/${PR}/reviews" --method POST --input - --jq '.html_url'
```
