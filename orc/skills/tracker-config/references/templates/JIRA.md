# Seed template — issue-tracker.md (Jira)

### issue-tracker.md — Jira

````markdown
# Issue tracker: Jira

Work items for this repo live in Jira project **[KEY]** at `[site]`. Use `acli` for all operations (reference: `orc:jira-cli` — including the ADF iron rule: anything richer than one plain paragraph must be ADF JSON via `--description-file` / `--body-file`).

## Conventions

- **Create**: `acli jira workitem create --project "[KEY]" --type "Task" --summary "..." --description "..."` (types are case-sensitive: `Task`, `Story`, `Bug`, `Epic`, `Sub-task`)
- **Read**: `acli jira workitem view [KEY]-123 --json`
- **List/query**: `acli jira workitem search --jql "project = [KEY] AND statusCategory != Done" --json`
- **Comment**: `acli jira workitem comment create --key "[KEY]-123" --body "..."`
- **Labels**: pass `--label "a,b"` on create; for label edits see `acli jira workitem edit --help`
- **Close**: `acli jira workitem transition --key "[KEY]-123" --status "Done"` (status names are site-specific and case-sensitive)

Triage state lives in **labels**, not workflow statuses (portable across Jira workflows) — see `docs/agents/triage-labels.md`. Jira label strings can't contain spaces or colons, so wayfinder/triage labels use hyphens here.

## Pull requests as a triage surface

**PRs as a request surface: no.** Code review stays on the code host: even with Jira as the tracker, external PRs are read and triaged via `gh`, with the triage outcome mirrored to a Jira work item when one exists.

## When a skill says "publish to the issue tracker"

Create a Jira work item in [KEY]. When a skill says "fetch the relevant ticket": `acli jira workitem view <KEY> --json`.

## Wayfinding operations

Used by `/orc:wayfinder`. The **map** is a single work item with **child** work items as tickets.

- **Map**: one Task labelled `wayfinder-map` holding the Destination / Notes / Decisions-so-far / fog body (body updates via `acli jira workitem edit --description-file`).
- **Child ticket**: a work item labelled `wayfinder-research|prototype|grilling|task`, with `Part of [KEY]-<map>` at the top of its description and a `Relates to` link to the map.
- **Blocking**: native links — `acli jira workitem link create --out [KEY]-<blocker> --in [KEY]-<blocked> --type Blocks --yes`. Unblocked = every blocker's statusCategory is Done.
- **Frontier**: `--jql "project = [KEY] AND labels in (wayfinder-research, wayfinder-prototype, wayfinder-grilling, wayfinder-task) AND statusCategory != Done AND assignee IS EMPTY"`, then drop tickets whose `issuelinks` show an open blocker; first in map order wins.
- **Claim**: assign the ticket to the driving dev (`--assignee "@me"`) — the session's first write.
- **Resolve**: `comment create` with the answer, `transition --status "Done"`, then append a gist + link to the map's Decisions-so-far.
````
