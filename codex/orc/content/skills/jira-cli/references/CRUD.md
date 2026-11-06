# Core operations — create / view / search / transition / scripting

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
