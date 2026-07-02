---
description: Manage Jira tickets via acli, and bind/unbind a ticket key to the current orc session — persists jiraTicket in .orc/orc.json + checkpoint.md so /orc:status, /orc:resume, and /orc:ship all see the link.
argument-hint: "<verb> [args] [--project KEY] [--type Story|Task|Bug|Epic|Sub-task] [--parent KEY] [--summary ...] [--description ...] [--assignee @me]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(acli *)
  - Bash(jq *)
  - Bash(git branch --show-current:*)
  - Bash(date:*)
---

# /orc:jira

Single entry point for Jira operations from inside an orc session. Wraps `acli` (the supported Atlassian CLI) and integrates with `.orc/` state so a ticket key, once bound, follows the work through `/orc:status`, `/orc:resume`, and `/orc:ship`.

Always invoke `orc:jira-cli` before running any `acli` command — it's the reference for flags, auth, and pitfalls.

## Verbs

| Verb | What it does | Touches `.orc/`? |
|------|-------------|------------------|
| `create` | Create a top-level ticket | optionally auto-binds the new key |
| `subtask` | Create a sub-task under a parent | optionally auto-binds the new key |
| `link` | Link two existing tickets (Jira-side relationship) | no |
| `bind <KEY>` | Attach `<KEY>` to the **current orc session** | yes (writes `jiraTicket`) |
| `unbind` | Remove the bound ticket from the current session | yes (clears `jiraTicket`) |
| `view [KEY]` | Show a ticket; defaults to current session's bound key | no |
| `transition [KEY] --to "<status>"` | Move a ticket to a new status | no |
| `search --jql "<query>"` | List tickets matching JQL | no |

## Workflow

### Phase 0 — Preflight

1. Invoke `orc:jira-cli`. Read it; the rest of this command assumes you know the `acli` flag conventions documented there.
2. Run `acli jira auth status`. If it exits non-zero, surface the auth-login hint from the skill and stop. **Never try to invoke a mutating `acli` command without confirming auth first.**

### Phase 1 — Dispatch on verb

Parse the first positional arg. If missing, surface `AskUserQuestion` with the eight verbs above. If the verb isn't recognized, surface the same prompt.

Then jump to the matching section below.

### Verb: `create`

```bash
acli jira workitem create \
  --summary "<summary>" \
  --project "<KEY>" \
  --type "<Task|Story|Bug|Epic>" \
  [--assignee "@me|email"] \
  [--description "<text>"] \
  [--label "<a,b>"] \
  --json
```

If `--summary`, `--project`, or `--type` is missing, prompt for it via `AskUserQuestion`. For long descriptions, fall back to `--editor` (opens `$EDITOR`) or `--description-file <path>`.

Capture `.key` from the JSON response:

```bash
NEW_KEY=$(acli jira workitem create … --json | jq -r '.key')
```

After creation, surface the new key + URL and ask via `AskUserQuestion`:

- `Bind <NEW_KEY> to this session` → recurse into `bind <NEW_KEY>`.
- `Don't bind — just print the key` → echo and exit.

### Verb: `subtask`

Identical to `create`, but with `--type "Sub-task"` and `--parent <PARENT-KEY>` required:

```bash
acli jira workitem create \
  --summary "<summary>" \
  --project "<KEY>" \
  --type "Sub-task" \
  --parent "<PARENT-KEY>" \
  --json
```

Default `--parent` to the current session's bound `jiraTicket` if it exists and the user didn't pass `--parent`. Surface the assumption via `AskUserQuestion` before sending: `Use bound parent <BOUND-KEY>` / `Specify a different parent` / `Cancel`.

### Verb: `link`

```bash
acli jira workitem link create \
  --out "<OUT-KEY>" \
  --in "<IN-KEY>" \
  --type "<Blocks|Relates to|...>" \
  --yes
```

If the user runs `/orc:jira link <OTHER-KEY>` without specifying `--out` and `--in`, default `--out` to the current session's bound `jiraTicket` (if any) and `--in` to the positional. Surface the resolved direction via `AskUserQuestion` before sending: `Confirm: <OUT> <link-type> <IN>` / `Swap direction` / `Cancel`.

If `--type` is missing, default to `Blocks` and surface the choice. If `acli` rejects the link type, run `acli jira workitem link type` and present the actual valid types via `AskUserQuestion`.

### Verb: `bind <KEY>`

The orc-specific glue. Persists the linked Jira ticket key into `.orc/` state.

1. **Validate** the key shape: `^[A-Z][A-Z0-9_]*-\d+$`. If it doesn't match, refuse and explain.
2. **Resolve the active session.** Determine the current branch:
   ```bash
   BRANCH=$(git branch --show-current)
   ```
   Sanitize: replace `/` with `-`. The session entry to mutate is the one in `.orc/orc.json` whose `branch` field matches the sanitized name AND whose `status` is `in_progress`.
3. **Iron rule:** If no in-progress session exists for this branch, REFUSE. Surface:

   ```markdown
   > [!CAUTION]
   > **🛑 Blocked — no active session**
   >
   > No active orc session for branch `<sanitized>`. Run `/orc:plan`, `/orc:start`, `/orc:debug`, or `/orc:flow` first to create one.
   ```
4. **Mutate `.orc/orc.json`** — set `jiraTicket` on the matching entry. Use `jq`:
   ```bash
   jq --arg b "$SANITIZED_BRANCH" --arg k "$KEY" \
      'map(if .branch == $b and .status == "in_progress" then .jiraTicket = $k else . end)' \
      .orc/orc.json > .orc/orc.json.tmp && mv .orc/orc.json.tmp .orc/orc.json
   ```
5. **Mutate `.orc/<sanitized-branch>/files/checkpoint.md` frontmatter** — add or replace the `jiraTicket: <KEY>` line. Read, edit, write.
6. Echo: `✓ Bound <KEY> to session on branch <sanitized-branch>.`

### Verb: `unbind`

Same session-resolution as `bind`. Then clear:

1. `jq` on `.orc/orc.json`: `map(if .branch == $b and .status == "in_progress" then del(.jiraTicket) else . end)`.
2. Remove the `jiraTicket:` line from `checkpoint.md` frontmatter.
3. Echo: `✓ Unbound <PREVIOUS-KEY> from session on branch <sanitized-branch>.`

If no `jiraTicket` was set, exit with a plain one-line echo: `No ticket bound to this session.` (status echoes stay plain — no callout).

### Verb: `view [KEY]`

If `KEY` is omitted, look up the current session's bound `jiraTicket`. If neither is provided, surface `AskUserQuestion`: `Provide a key` / `Cancel`.

```bash
acli jira workitem view "$KEY" --fields "key,summary,status,assignee,priority,description"
```

Add `--web` if user passed `--web` to `/orc:jira`.

### Verb: `transition [KEY] --to "<status>"`

If `KEY` is omitted, default to the current session's bound `jiraTicket`. If `--to` is omitted, surface `AskUserQuestion` listing common targets (`In Progress`, `In Review`, `Done`, `Blocked`) plus `Other (specify)`.

```bash
acli jira workitem transition --key "$KEY" --status "$STATUS" --yes
```

If the workflow rejects the transition, surface `acli`'s error and stop — don't guess at a different status.

### Verb: `search --jql "<query>"`

```bash
acli jira workitem search --jql "$JQL" --limit "${LIMIT:-25}" --json | jq -r '.[] | "\(.key)\t\(.fields.status.name)\t\(.fields.summary)"' | column -t -s $'\t'
```

If `--web` was passed, use `--web` instead of JSON.

## Output

Per verb:

- `create` / `subtask` — new key + URL, optional bind confirmation.
- `link` — confirmation of the created link.
- `bind` / `unbind` — single-line `✓ Bound <KEY>` / `✓ Unbound <KEY>`.
- `view` — formatted ticket summary.
- `transition` — `✓ <KEY> → <status>`.
- `search` — table of results.

## Iron rules

- **Never call a mutating `acli` command without `acli jira auth status` exiting 0 first.** Catch auth errors at the door, not after the user wonders why nothing happened.
- **`bind` / `unbind` require an active session.** This command does NOT create `.orc/` state on its own — that's `/orc:plan`, `/orc:start`, `/orc:debug`, `/orc:flow`'s job. If no session exists, point the user there.
- **Validate key shape before mutating files.** A typo'd key in `.orc/orc.json` propagates to PR bodies and resume summaries.
- **Don't paste real ticket keys into committed examples.** This command and the `jira-cli` skill use placeholders like `PROJ-123` / `JRA-123`. Real keys leak structure.

## Resume

This command is single-shot — no checkpoints, no resume. Each verb either succeeds, fails cleanly, or exits at a user gate.
