# Pull Requests (gh pr)

## Create Pull Request

```bash
# Create PR interactively
gh pr create

# Create with title
gh pr create --title "Feature: Add new functionality"

# Create with title and body
gh pr create \
  --title "Feature: Add new functionality" \
  --body "This PR adds..."

# Fill body from template
gh pr create --body-file .github/PULL_REQUEST_TEMPLATE.md

# Set base branch
gh pr create --base main

# Set head branch (default: current branch)
gh pr create --head feature-branch

# Create draft PR
gh pr create --draft

# Add assignees
gh pr create --assignee user1,user2

# Add reviewers
gh pr create --reviewer user1,user2

# Add labels
gh pr create --labels enhancement,feature

# Link to issue
gh pr create --issue 123

# Create in specific repository
gh pr create --repo owner/repo

# Open in browser after creation
gh pr create --web
```

## List Pull Requests

```bash
# List open PRs
gh pr list

# List all PRs
gh pr list --state all

# List merged PRs
gh pr list --state merged

# List closed (not merged) PRs
gh pr list --state closed

# Filter by head branch
gh pr list --head feature-branch

# Filter by base branch
gh pr list --base main

# Filter by author
gh pr list --author username
gh pr list --author @me

# Filter by assignee
gh pr list --assignee username

# Filter by labels
gh pr list --labels bug,enhancement

# Limit results
gh pr list --limit 50

# Search
gh pr list --search "is:open is:pr label:review-required"

# JSON output
gh pr list --json number,title,state,author,headRefName

# Show check status
gh pr list --json number,title,statusCheckRollup --jq '.[] | [.number, .title, .statusCheckRollup[]?.status]'

# Sort by
gh pr list --sort created --order desc
```

## View Pull Request

```bash
# View PR
gh pr view 123

# View with comments
gh pr view 123 --comments

# View in browser
gh pr view 123 --web

# JSON output
gh pr view 123 --json title,body,state,author,commits,files

# View diff
gh pr view 123 --json files --jq '.files[].path'

# View with jq query
gh pr view 123 --json title,state --jq '"\(.title): \(.state)"'
```

## Checkout Pull Request

```bash
# Checkout PR branch
gh pr checkout 123

# Checkout with specific branch name
gh pr checkout 123 --branch name-123

# Force checkout
gh pr checkout 123 --force
```

## Diff Pull Request

```bash
# View PR diff
gh pr diff 123

# View diff with color
gh pr diff 123 --color always

# Output to file
gh pr diff 123 > pr-123.patch

# View diff of specific files
gh pr diff 123 --name-only
```

## Merge Pull Request

```bash
# Merge PR
gh pr merge 123

# Merge with specific method
gh pr merge 123 --merge
gh pr merge 123 --squash
gh pr merge 123 --rebase

# Delete branch after merge
gh pr merge 123 --delete-branch

# Merge with comment
gh pr merge 123 --subject "Merge PR #123" --body "Merging feature"

# Merge draft PR
gh pr merge 123 --admin

# Force merge (skip checks)
gh pr merge 123 --admin
```

## Close Pull Request

```bash
# Close PR (as draft, not merge)
gh pr close 123

# Close with comment
gh pr close 123 --comment "Closing due to..."
```

## Reopen Pull Request

```bash
# Reopen closed PR
gh pr reopen 123
```

## Edit Pull Request

```bash
# Edit interactively
gh pr edit 123

# Edit title
gh pr edit 123 --title "New title"

# Edit body
gh pr edit 123 --body "New description"

# Add labels
gh pr edit 123 --add-label bug,enhancement

# Remove labels
gh pr edit 123 --remove-label stale

# Add assignees
gh pr edit 123 --add-assignee user1,user2

# Remove assignees
gh pr edit 123 --remove-assignee user1

# Add reviewers
gh pr edit 123 --add-reviewer user1,user2

# Remove reviewers
gh pr edit 123 --remove-reviewer user1

# Mark as ready for review
gh pr edit 123 --ready
```

## Ready for Review

```bash
# Mark draft PR as ready
gh pr ready 123
```

## Pull Request Checks

```bash
# View PR checks
gh pr checks 123

# Watch checks in real-time
gh pr checks 123 --watch

# Watch interval (seconds)
gh pr checks 123 --watch --interval 5
```

## Comment on Pull Request

```bash
# Add comment
gh pr comment 123 --body "Looks good!"

# Comment on specific line
gh pr comment 123 --body "Fix this" \
  --repo owner/repo \
  --head-owner owner --head-branch feature

# Edit comment
gh pr comment 123 --edit 456789 --body "Updated"

# Delete comment
gh pr comment 123 --delete 456789
```

## Review Pull Request

```bash
# Review PR (opens editor)
gh pr review 123

# Approve PR
gh pr review 123 --approve --body "LGTM!"

# Request changes
gh pr review 123 --request-changes \
  --body "Please fix these issues"

# Comment on PR
gh pr review 123 --comment --body "Some thoughts..."

# Dismiss review
gh pr review 123 --dismiss
```

> ⚠️ `gh pr review` posts a **top-level review only** — no inline comments, no suggestion blocks. For real GitHub PR reviews with comments anchored to specific files/lines (and one-click "Apply suggestion" buttons), see the next section. orc's `/orc:code-review` and the `orc:inline-review` skill use that path by default.

## PR Review with inline comments + suggestions

GitHub's REST API endpoint `POST /repos/{owner}/{repo}/pulls/{pr}/reviews` accepts a single payload that creates a review with N inline comments + an overall body + a review event. This is the GitHub-native way to post a structured review programmatically. Atomic: all comments post together with the event, or the call fails as a whole.

**Atomic batched POST** (default path used by orc's `/orc:code-review`):

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
      "body": "user input flows into raw SQL — parameterize via \`\$1\`/\`\$2\`."
    }
  ]
}
EOF
```

**`event` enum:**

| Value | Meaning |
|-------|---------|
| `APPROVE` | LGTM — the review approves the PR |
| `COMMENT` | Comments only, no approval/rejection |
| `REQUEST_CHANGES` | Block the PR until comments addressed |

**`comments[]` schema** (per inline comment):

| Field | Required | Notes |
|-------|----------|-------|
| `path` | yes | Repo-relative POSIX path (e.g. `src/api/users.ts`). Not URL, not prefixed with `a/` or `b/`. |
| `line` | yes | Line number in the **NEW** file (post-change). Not the diff hunk offset. For multi-line spans, this is the END line. |
| `side` | yes | `"RIGHT"` for comments on added/changed code (almost always). `"LEFT"` is for comments on removed code. |
| `start_line` | no | For multi-line spans, the START line. Single-line findings omit this or set it null. Must satisfy `start_line ≤ line`. |
| `start_side` | no | Pairs with `start_line`; usually `"RIGHT"`. |
| `body` | yes | Markdown. Comment text. May contain a triple-backtick `suggestion` block (see below) for one-click apply. |

**Suggestion block format** (inside the comment `body`):

````
Brief prose description of the problem.

```suggestion
const token = parseToken(req);
if (!token) return res.status(401).end();
```

Optional follow-up prose (caveat, edge case).
````

GitHub renders this as a "Apply suggestion" button. Standard markdown — no special API handling needed beyond putting the block inside the comment body. Use only for fixes that are < 6 lines AND fully resolve the issue (don't smuggle refactors).

**After posting**, the response includes the new review's `html_url` and `id`. Capture with `--jq`:

```bash
REVIEW_URL=$(echo "$PAYLOAD" | gh api repos/${OWNER}/${REPO}/pulls/${PR}/reviews \
  --method POST --input - --jq '.html_url')
echo "Posted: $REVIEW_URL"
```

**Listing existing reviews** on a PR:

```bash
gh pr view 123 --json reviews
gh api repos/${OWNER}/${REPO}/pulls/123/reviews
```

**Fetching a specific review** (after posting):

```bash
gh api repos/${OWNER}/${REPO}/pulls/${PR}/reviews/${REVIEW_ID}
```

For the full posting orchestration (severity → event mapping, preview gate, MCP fallback), see `orc:inline-review`.

## Update Branch

```bash
# Update PR branch with latest base branch
gh pr update-branch 123

# Force update
gh pr update-branch 123 --force

# Use merge strategy
gh pr update-branch 123 --merge
```

## Lock/Unlock Pull Request

```bash
# Lock PR conversation
gh pr lock 123

# Lock with reason
gh pr lock 123 --reason off-topic

# Unlock
gh pr unlock 123
```

## Revert Pull Request

```bash
# Revert merged PR
gh pr revert 123

# Revert with specific branch name
gh pr revert 123 --branch revert-pr-123
```

## Pull Request Status

```bash
# Show PR status summary
gh pr status

# Status for specific repository
gh pr status --repo owner/repo
```
