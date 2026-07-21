---
name: jira-cli
description: "Atlassian CLI (acli) reference for Jira work items — create, sub-task, link, view, JQL search, transition. Use to file/move/link a Jira ticket from the terminal or when /orc:jira is invoked."
---

# Jira CLI (acli)

Reference for Atlassian's `acli` — the supported CLI for Jira (and Confluence). orc commands lean on this skill whenever they touch a ticket: `/orc:jira`, the Phase 1 Jira-link prompt in `/orc:plan|debug|flow`, and `/orc:ship`'s "Resolves <KEY>" line in PR bodies.

**Verified version:** acli 1.3.18-stable (2026-05-02). Help text used to author this skill came from `acli jira workitem [subcommand] --help` on that version.

## Iron rule: ADF JSON for rich bodies on Jira Cloud

<EXTREMELY-IMPORTANT>
Jira Cloud's REST API v3 stores rich-text fields (description, comments, sub-task bodies) as **ADF (Atlassian Document Format) JSON**. It does not render Markdown, and it does not render wiki markup either — anything you pass as plain text is wrapped in a single text node and shown verbatim. `**bold**`, `# heading`, ` ```code``` `, `h3. Title`, `*bold*`, `{code} … {code}` all come through as literal characters and make tickets look broken.

For anything richer than a single paragraph of plain prose, build an ADF document and pass it via `--description-file ./body.adf.json` (or the equivalent ADF object inside a `--from-json` payload). Generate a starter shape with `acli jira workitem create --generate-json` and look at the `description` field — that is the canonical ADF shape acli expects.

Plain one-line summaries and short single-paragraph descriptions can still be passed as bare strings via `--summary` / `--description`; acli wraps them in an ADF text node for you. Everything else (headings, lists, tables, code blocks, links, bold/italic) is ADF or nothing.
</EXTREMELY-IMPORTANT>

### Minimal ADF skeleton

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    { "type": "paragraph", "content": [
      { "type": "text", "text": "Plain paragraph with " },
      { "type": "text", "text": "bold", "marks": [{ "type": "strong" }] },
      { "type": "text", "text": " and " },
      { "type": "text", "text": "a link", "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }] },
      { "type": "text", "text": "." }
    ]}
  ]
}
```

### Markdown → ADF node cheatsheet

| Need            | Markdown (do NOT send) | ADF node shape                                                                                          |
|-----------------|------------------------|---------------------------------------------------------------------------------------------------------|
| Heading (1–6)   | `## Section`           | `{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section" }] }`    |
| Paragraph       | (default)              | `{ "type": "paragraph", "content": [{ "type": "text", "text": "…" }] }`                                 |
| Bold            | `**bold**`             | text node + `"marks": [{ "type": "strong" }]`                                                            |
| Italic          | `*italic*`             | text node + `"marks": [{ "type": "em" }]`                                                                |
| Strikethrough   | `~~text~~`             | text node + `"marks": [{ "type": "strike" }]`                                                            |
| Inline code     | `` `code` ``           | text node + `"marks": [{ "type": "code" }]`                                                              |
| Code block      | ` ```lang … ``` `      | `{ "type": "codeBlock", "attrs": { "language": "ts" }, "content": [{ "type": "text", "text": "…" }] }`  |
| Link            | `[text](https://…)`    | text node + `"marks": [{ "type": "link", "attrs": { "href": "https://…" } }]`                            |
| Bullet list     | `- item`               | `{ "type": "bulletList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", … }] }] }` |
| Numbered list   | `1. item`              | `{ "type": "orderedList", "content": [{ "type": "listItem", … }] }`                                      |
| Blockquote      | `> quoted`             | `{ "type": "blockquote", "content": [{ "type": "paragraph", … }] }`                                      |
| Horizontal rule | `---`                  | `{ "type": "rule" }`                                                                                     |
| Table           | (none)                 | `{ "type": "table", "content": [{ "type": "tableRow", "content": [{ "type": "tableHeader" \| "tableCell", "content": [{ "type": "paragraph", … }] }] }] }` |
| Mention         | `@user`                | `{ "type": "mention", "attrs": { "id": "<accountId>", "text": "@Name" } }` (inline, inside a paragraph)  |
| Panel/note      | (none)                 | `{ "type": "panel", "attrs": { "panelType": "info" }, "content": [{ "type": "paragraph", … }] }`         |

A few invariants that catch most authoring bugs:

- The root is always `{ "type": "doc", "version": 1, "content": [ … ] }`.
- Inline nodes (`text`, `mention`, `hardBreak`) only live inside a block node like `paragraph`, `heading`, `codeBlock`, or a list item's paragraph.
- `listItem` content is a list of block nodes — almost always at least one `paragraph`.
- `codeBlock.attrs.language` is optional but improves rendering; `panel.attrs.panelType` must be one of `info | note | warning | success | error`.
- Don't use both `code` and other marks on the same text node — Jira drops the others.

### When a PRD/spec arrives as Markdown

Treat `--description-file ./foo.md` as a smell. Either:

1. Convert the Markdown to ADF first and pass `--description-file ./foo.adf.json`, or
2. Build the ADF programmatically (most reliable when the body has tables, code, or many headings).

Renaming a `.md` file to `.json` does **not** make acli parse it as ADF; the file's *contents* must be a valid ADF document.

## Prerequisites

### Installation

```bash
# macOS
brew install --cask atlassian-acli

# Linux / Windows / other
# See https://developer.atlassian.com/cloud/acli/guides/how-to-get-started/

# Verify
acli --version          # acli version 1.3.18-stable
```

### Authentication (one-time per machine)

```bash
# Web/OAuth flow (recommended; opens browser)
acli jira auth login --web

# Token flow (for headless / CI)
echo "$ATLASSIAN_API_TOKEN" | acli jira auth login \
  --site "mysite.atlassian.net" \
  --email "you@example.com" \
  --token

# Verify
acli jira auth status

# Switch between accounts
acli jira auth switch

# Sign out
acli jira auth logout
```

If a `acli jira` command returns an auth error, re-run `acli jira auth login --web`. Don't try to debug 401s — just re-auth.

## CLI structure

Top-level groups:

```
acli
├── admin        Atlassian admin operations
├── auth         Top-level auth (covered by jira/auth)
├── confluence   Confluence operations (out of scope here)
├── jira         Jira operations (this skill)
├── rovodev      Rovo Dev integration
├── completion   Shell completion
├── config       acli configuration
├── feedback     Send feedback to Atlassian
└── help         Help about any command
```

`jira` subgroup:

```
acli jira
├── auth         login | logout | status | switch
└── workitem
    ├── archive
    ├── assign
    ├── attachment
    ├── clone
    ├── comment
    ├── create
    ├── create-bulk
    ├── delete
    ├── edit
    ├── link        create | delete | list | type
    ├── search
    ├── transition
    ├── unarchive
    ├── view
    └── watcher
```

This skill covers the verbs orc uses day-to-day: **create**, **link create**, **view**, **search**, **transition**. The rest are documented inline at point-of-use; reach for `acli jira workitem <verb> --help` for anything not below.

## Core operations

### Create a top-level ticket

```bash
# Minimal
acli jira workitem create \
  --summary "Implement webhook retries" \
  --project "PLAT" \
  --type "Story"

# With assignee + description + labels
acli jira workitem create \
  --summary "Add CSV export to /reports" \
  --project "PLAT" \
  --type "Task" \
  --assignee "@me" \
  --description "Users want to download report data as CSV." \
  --label "reports,export"

# JSON output (for scripting — capture the new key)
acli jira workitem create \
  --summary "Fix flaky billing test" \
  --project "PLAT" \
  --type "Bug" \
  --json | jq -r '.key'

# Open editor for summary + description (multi-line)
acli jira workitem create --project "PLAT" --type "Task" --editor

# Rich description from a file — MUST be ADF JSON for anything beyond a single paragraph.
# See "Iron rule: ADF JSON" above for the document shape.
acli jira workitem create \
  --summary "Refactor session middleware" \
  --project "PLAT" \
  --type "Task" \
  --description-file ./session-refactor.adf.json

# Updating an existing ticket's description with ADF works the same way:
acli jira workitem edit PLAT-1234 --description-file ./session-refactor.adf.json
```

**Required:** `--summary`, `--project`, `--type`. **Type values** (case sensitive — match what your project allows): typically `Task`, `Story`, `Bug`, `Epic`, `Sub-task`. Misspelling silently creates the wrong type or 400s.

### Create a sub-task

Sub-tasks are just `--type "Sub-task"` plus `--parent`:

```bash
acli jira workitem create \
  --summary "Add JSON-stream output to retry runner" \
  --project "PLAT" \
  --type "Sub-task" \
  --parent "PLAT-1234"
```

The parent must already exist. The sub-task inherits the parent's project; passing a different `--project` is allowed but rarely what you want.

### Link two existing tickets

```bash
# Block: PLAT-100 blocks PLAT-200 (PLAT-200 cannot start until PLAT-100 ships)
acli jira workitem link create \
  --out PLAT-100 \
  --in PLAT-200 \
  --type Blocks

# Relates to (symmetric — direction doesn't matter semantically)
acli jira workitem link create \
  --out PLAT-100 \
  --in PLAT-300 \
  --type "Relates to"

# Skip the confirmation prompt
acli jira workitem link create --out PLAT-100 --in PLAT-400 --type Blocks --yes
```

`--out` is the **outward** key, `--in` is the **inward** key. `--type` accepts the Jira link-type label (the *outward* description: `Blocks`, `Relates to`, `Causes`, `Duplicates`, `Clones`, `Implements`). Site-specific link types vary — list them with `acli jira workitem link type` if a `--type` value gets rejected.

### View a ticket

```bash
# Default fields (key, issuetype, summary, status, assignee, description)
acli jira workitem view PLAT-1234

# Specific fields only
acli jira workitem view PLAT-1234 --fields "key,summary,status,assignee"

# JSON for scripting
acli jira workitem view PLAT-1234 --json | jq '.fields.summary'

# All fields
acli jira workitem view PLAT-1234 --fields "*all" --json

# Open in browser
acli jira workitem view PLAT-1234 --web
```

### Search via JQL

```bash
# Basic
acli jira workitem search --jql "project = PLAT AND status = Open"

# Limit + JSON for scripting
acli jira workitem search --jql "assignee = currentUser() AND status != Done" --limit 25 --json

# Count matching tickets
acli jira workitem search --jql "project = PLAT AND created >= -7d" --count

# CSV export with custom fields
acli jira workitem search \
  --jql "project = PLAT AND fixVersion = '2026.05'" \
  --fields "key,summary,assignee,status,priority" \
  --csv > release-tickets.csv

# Paginate through all results (no limit cap)
acli jira workitem search --jql "project = PLAT" --paginate --json
```

JQL reference: https://support.atlassian.com/jira-software-cloud/docs/jql-fields/. Common predicates: `project = X`, `assignee = currentUser()`, `status in ("In Progress", "Code Review")`, `created >= -7d`, `labels = "rollback"`, `parent = PLAT-100`.

### Transition status

```bash
# Move one ticket
acli jira workitem transition --key "PLAT-1234" --status "In Progress"

# Move multiple tickets at once
acli jira workitem transition --key "PLAT-1234,PLAT-1235,PLAT-1240" --status "Done" --yes

# Transition everything matching a JQL filter
acli jira workitem transition \
  --jql "project = PLAT AND status = 'Code Review' AND assignee = currentUser()" \
  --status "Ready for QA" \
  --yes
```

`--status` must match the **target status name** exactly as Jira shows it (case-sensitive, including spaces). If the workflow doesn't allow the transition from the ticket's current state, the command fails — list available transitions with `acli jira workitem view <KEY> --fields "transitions"` (Jira-config dependent).

## JSON + scripting

`--json` is your friend. Pipe through `jq`:

```bash
# Capture the key of a freshly created ticket into a variable
NEW_KEY=$(acli jira workitem create \
  --summary "Spike: evaluate pgbouncer 1.22" \
  --project "PLAT" --type "Task" --json | jq -r '.key')

# List all open tickets assigned to me as plain `KEY  summary` lines
acli jira workitem search \
  --jql "assignee = currentUser() AND statusCategory != Done" \
  --fields "key,summary" --json \
  | jq -r '.[] | "\(.key)  \(.fields.summary)"'

# Bulk-link a list of children to a parent
for child in PLAT-101 PLAT-102 PLAT-103; do
  acli jira workitem link create --out PLAT-100 --in "$child" --type Blocks --yes
done
```

For very bulky operations the CLI offers `--from-json` (read a definition from a JSON file). Generate a starter shape with `--generate-json`:

```bash
acli jira workitem create --generate-json > /tmp/workitem.json
$EDITOR /tmp/workitem.json
acli jira workitem create --from-json /tmp/workitem.json
```

## Attachments & comments

Both verbs exist in the `workitem` tree but behave asymmetrically — **comments have a CLI create path; attachments do not.**

### Comments — `acli jira workitem comment create`

```bash
# One-liner
acli jira workitem comment create --key "PROJ-123" --body "Deployed to staging; smoke test green."

# Multi-line / ADF body from a file
acli jira workitem comment create --key "PROJ-123" --body-file ./comment.txt

# Open $EDITOR instead of prompting
acli jira workitem comment create --key "PROJ-123" --editor
```

`--body` / `--body-file` are **plain text or ADF JSON** — the same ADF rule as descriptions applies: markdown and wiki markup render literally (see the "Markdown or wiki markup" pitfall below). For anything richer than a plain paragraph, build a real ADF document. `--jql` comments many tickets at once; `--edit-last` amends your previous comment. List/amend with `acli jira workitem comment list|update --key <KEY>`.

### Attachments — list/delete via CLI, **upload via REST**

`acli jira workitem attachment` exposes only `list` and `delete` — **there is no `add`/`create`**. To upload a file you must call the REST API directly:

```bash
SITE=$(acli jira auth status | awk -F': ' '/Site:/{print $2; exit}')
EMAIL=$(acli jira auth status | awk -F': ' '/Email:/{print $2; exit}')
# Token is NOT exposed by acli — supply your own Atlassian API token via the env.
curl -sf -X POST \
  -u "$EMAIL:$JIRA_API_TOKEN" \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@./screenshot-01.png" \
  "https://$SITE/rest/api/3/issue/PROJ-123/attachments"

# Verify / clean up via the CLI
acli jira workitem attachment list --key "PROJ-123" --json | jq -r '.[].filename'
```

- `X-Atlassian-Token: no-check` is **required** (XSRF guard) — the upload 403s without it.
- `SITE` + `EMAIL` come free from `acli jira auth status`; only the token is missing, since acli never prints its stored credential. Read `JIRA_API_TOKEN` from the env; never echo it or commit it.

For the full "collect QA screenshots → attach + comment, or keep local" flow (curation, the preview gate, local-only fallback, provenance), use **`orc:evidence-publish`** — it drives exactly these commands. `/orc:qa` Phase 6 and `/orc:evidence` are its callers.

## Common pitfalls

- **`--type` casing** — `task` ≠ `Task`. Use the exact label your Jira project uses. If you see a 400 on create, casing is the most likely culprit.
- **Sub-task without `--parent`** — silently creates a Story (or whatever the project's default is) instead of a Sub-task. Always pair the two.
- **`link create --type` rejects** — your site has custom link types. Run `acli jira workitem link type` to list valid `--type` values.
- **`transition --status` rejects** — the target status isn't reachable from the ticket's current state in the workflow, or the spelling is wrong. List the ticket's current allowed transitions before retrying.
- **Auth tokens expire silently** — a `401` after weeks of working commands usually means a token rotation, not a CLI bug. Re-run `acli jira auth login --web`.
- **Don't paste real ticket keys into committed files** — examples in skills, commands, and docs should use placeholders like `PROJ-123` or `JRA-123`. Real keys leak project structure.
- **Markdown or wiki markup in description/comment bodies** — Jira Cloud's REST v3 stores rich-text fields as ADF JSON. Both `**bold**` *and* `h3. Title` / `*bold*` come through as literal characters, because acli wraps any non-JSON body in a single ADF text node. See the "Iron rule: ADF JSON" section above and build a proper ADF doc before sending anything richer than a one-paragraph plain string.

## Using jira-cli with orc

When this skill is invoked from an orc command, **prefer `--json` output and pipe through `jq`** so the parsing is deterministic. Two patterns recur:

1. **Capture key after create** — used by `/orc:jira create`. Capture `.key` from the JSON response, then immediately call `/orc:jira bind <KEY>` (or write to `.orc/orc.json` directly) so the new ticket is attached to the active session without a second user prompt.
2. **Read summary for branch naming** — `/orc:start --jira <KEY>` calls `acli jira workitem view <KEY> --fields "summary" --json | jq -r '.fields.summary'`, slugifies the result (lowercase, replace non-`[a-z0-9-]` with `-`, collapse repeats), and offers `feat/<KEY>-<slug>` to `orc:using-git-worktrees` as the suggested branch name.

Both patterns assume `acli jira auth status` exits 0 — gate on it before running mutating commands and surface the auth-login hint if not.

## Getting help

```bash
acli --help
acli jira --help
acli jira workitem --help
acli jira workitem create --help
acli jira workitem link create --help
```

## References

- Atlassian getting-started: https://developer.atlassian.com/cloud/acli/guides/how-to-get-started/
- JQL reference: https://support.atlassian.com/jira-software-cloud/docs/jql-fields/
- Sibling orc skills: `orc:gh-cli` (same patterns for GitHub), `orc:sentry-cli` (same patterns for Sentry).
