---
name: jira-cli
description: Atlassian CLI (acli) reference for Jira work-item operations — create tickets, create sub-tasks, link work items, view, search via JQL, and transition status. Use when the user asks to file/move/link a Jira ticket from the terminal, when /orc:jira is invoked, or when /orc:plan|debug|flow is asked to record a Jira ticket key for the current session.
---

# Jira CLI (acli)

Reference for Atlassian's `acli` — the supported CLI for Jira (and Confluence). orc commands lean on this skill whenever they touch a ticket: `/orc:jira`, the Phase 1 Jira-link prompt in `/orc:plan|debug|flow`, and `/orc:ship`'s "Resolves <KEY>" line in PR bodies.

**Verified version:** acli 1.3.18-stable (2026-05-02). Help text used to author this skill came from `acli jira workitem [subcommand] --help` on that version.

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

# From a file (description in plain text or ADF)
acli jira workitem create \
  --summary "Refactor session middleware" \
  --project "PLAT" \
  --type "Task" \
  --description-file ./session-refactor-prd.md
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

## Common pitfalls

- **`--type` casing** — `task` ≠ `Task`. Use the exact label your Jira project uses. If you see a 400 on create, casing is the most likely culprit.
- **Sub-task without `--parent`** — silently creates a Story (or whatever the project's default is) instead of a Sub-task. Always pair the two.
- **`link create --type` rejects** — your site has custom link types. Run `acli jira workitem link type` to list valid `--type` values.
- **`transition --status` rejects** — the target status isn't reachable from the ticket's current state in the workflow, or the spelling is wrong. List the ticket's current allowed transitions before retrying.
- **Auth tokens expire silently** — a `401` after weeks of working commands usually means a token rotation, not a CLI bug. Re-run `acli jira auth login --web`.
- **Don't paste real ticket keys into committed files** — examples in skills, commands, and docs should use placeholders like `PROJ-123` or `JRA-123`. Real keys leak project structure.

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
