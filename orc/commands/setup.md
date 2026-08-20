---
description: "Run-once repo interview that writes the tracker layer (docs/agents/issue-tracker.md, triage-labels.md, domain.md) with recommended answers. Use when configuring a repo for orc's tracker-aware surfaces or when switching trackers."
argument-hint: "[--tracker github|jira|local]"
license: MIT
metadata:
  author: Matt Pocock
  source: Adapted from https://github.com/mattpocock/skills @ 2ffb184
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git remote:*)
  - Bash(gh repo view:*)
  - Bash(gh auth status:*)
  - Bash(gh label list:*)
  - Bash(acli:*)
  - Bash(command -v:*)
  - Bash(ls:*)
---

# /orc:setup

Scaffold the per-repo configuration that orc's tracker-aware surfaces assume:

- **Issue tracker** — where issues live and how to create/query them → `docs/agents/issue-tracker.md`
- **Triage labels** — the label vocabulary for the triage state machine → `docs/agents/triage-labels.md`
- **Domain docs** — where `CONTEXT.md` and ADRs live, and the consumer rules for reading them (per `orc:domain-modeling`) → `docs/agents/domain.md`

These files are read by `orc:to-issues`, `orc:to-prd`, `/orc:triage`, `/orc:wayfinder`, and the Jira adapters (`orc:jira-cli`, `orc:evidence-publish`) — the tracker choice recorded here decides whether they call `gh`, `acli`, or write local markdown.

This is a prompt-driven interview, not a deterministic script: explore, present what you found, confirm, then write. **Run once per repo.** Re-run only to switch trackers or restart from scratch — day-to-day edits go straight into `docs/agents/*.md`.

## Arguments

- `--tracker github|jira|local` — pre-answer Section A; the interview skips the tracker question and only confirms details (project key for Jira, directory for local).

## Workflow

### Phase 1 — Explore (auto-settle)

Look before asking. Every fact settled here removes a question from Phase 2:

- `git remote -v` — GitHub remote? Which repo? `gh repo view --json nameWithOwner,hasIssuesEnabled` and `gh auth status` confirm the `gh` path works.
- `command -v acli` + `acli jira auth status` — is the Jira CLI installed and authenticated? Only offer Jira as a recommended answer when it is.
- `gh label list` — existing label vocabulary. If labels matching the five canonical triage roles (or close variants like `bug:triage`) already exist, capture them as the proposed mapping instead of proposing new labels.
- `docs/agents/` — prior output of this command? If `issue-tracker.md` exists, this is an **update run**: show the current choice and ask whether to keep, tweak, or restart.
- `CLAUDE.md` / `AGENTS.md` at the repo root — which exists, and does either already have an `## Agent skills` section?
- `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/` — existing domain-doc layout.
- Monorepo signals — `pnpm-workspace.yaml`, a `workspaces` field, `turbo.json`, populated `packages/*` with their own `src/`. Absence means single-context, which is almost every repo.

### Phase 2 — Interview (recommended answer first)

Summarise what exploration found, then take the sections in order — one section, one answer. Lead every question with the recommended answer so the user can accept it in a word. **Skip any section exploration already settled** and say so in one line.

**Section A — Issue tracker.** Skip if `--tracker` was passed. Otherwise print the Gate headline (`**⛔ Gate — issue tracker**`, one line on what exploration found, per `orc:callouts`), then `AskUserQuestion` with the recommendation first:

- **GitHub Issues** (recommended when a GitHub remote + `gh` auth were found) — issues live in the repo's GitHub Issues, driven by `gh` (`orc:gh-cli`).
- **Jira** (recommended when `acli` is installed and authenticated) — work items live in a Jira project, driven by `acli` (`orc:jira-cli`). Follow up with one question: the project key (validate `^[A-Z][A-Z0-9_]*$`).
- **Local markdown** (recommended when there's no remote or the user works solo) — issues live as committed files under `docs/issues/<slug>/`.
- **Other** — the user describes the workflow in a paragraph; record it as freeform prose in `docs/agents/issue-tracker.md`.

The GitHub template carries a "PRs as a request surface" flag defaulted **off** — leave it off and don't raise it; a user who wants external PRs in the triage queue flips the flag in the file later.

**Section B — Triage labels.** Ask exactly one question, recommendation first: *keep the default triage labels?* (recommended: **yes**). Defaults are the five canonical state roles, each label string equal to its role name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — plus the two category roles `bug` / `enhancement`. Auto-skip when Phase 1 found an existing vocabulary that maps cleanly — present the discovered mapping for a one-word confirm instead. On "no", collect the overrides so `/orc:triage` applies existing labels instead of creating duplicates.

**Section C — Domain docs.** Default to **single-context** — one `CONTEXT.md` + `docs/adr/` at the repo root — and write it **without asking**; this fits almost every repo. Only when Phase 1 found monorepo signals, ask single- vs multi-context (`CONTEXT-MAP.md` pointing at per-context `CONTEXT.md` files, per `orc:domain-modeling`).

### Phase 3 — Preview and confirm

Print `**📋 Preview — tracker layer**` (per `orc:callouts`) followed by drafts of:

1. `docs/agents/issue-tracker.md` (from the matching seed template below)
2. `docs/agents/triage-labels.md`
3. `docs/agents/domain.md`
4. The `## Agent skills` block for `CLAUDE.md` / `AGENTS.md`

Then `AskUserQuestion`: **Write them** / **Edit first — tell me what to change** / **Cancel**.

### Phase 4 — Write

1. Write the three `docs/agents/*.md` files.
2. Pick the memory file: edit `CLAUDE.md` if it exists, else `AGENTS.md` if it exists; if **neither** exists, ask which to create — never pick silently, and never create one when the other is already there. If an `## Agent skills` block already exists, update it in place rather than appending a duplicate; don't touch surrounding sections. The block:

   ```markdown
   ## Agent skills

   ### Issue tracker

   [one line — where issues are tracked]. See `docs/agents/issue-tracker.md`.

   ### Triage labels

   [one line — the label vocabulary]. See `docs/agents/triage-labels.md`.

   ### Domain docs

   [one line — "single-context" or "multi-context"]. See `docs/agents/domain.md`.
   ```

3. Close with `**➡️ Next**`: name the surfaces now unlocked (`/orc:triage`, `/orc:wayfinder`, `orc:to-issues`, `orc:to-prd`) and note that `docs/agents/*.md` can be edited directly later.

## Seed templates

Start from the matching template and fill the bracketed slots; trim sections that don't apply. For "Other" trackers, write `docs/agents/issue-tracker.md` from scratch out of the user's description, keeping the same headings.

### issue-tracker.md — GitHub Issues

````markdown
# Issue tracker: GitHub

Issues for this repo live as GitHub Issues in `[owner/repo]`. Use the `gh` CLI for all operations (reference: `orc:gh-cli`).

## Conventions

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies)
- **Read**: `gh issue view <n> --comments`
- **List**: `gh issue list --state open --json number,title,labels` with `--label` filters
- **Comment**: `gh issue comment <n> --body "..."`
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <n> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/orc:triage` reads this flag.)_

When `yes`, external PRs run through the same labels and states via `gh pr view/diff/comment/edit/close`. Discovery keeps only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`. GitHub shares one number space, so resolve a bare `#42` with `gh pr view 42`, falling back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue. When a skill says "fetch the relevant ticket": `gh issue view <n> --comments`.

## Wayfinding operations

Used by `/orc:wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map` holding the Destination / Notes / Decisions-so-far / fog body.
- **Child ticket**: a sub-issue of the map (`gh api` on the sub-issues endpoint; where unavailable, a task-list entry in the map body plus `Part of #<map>` at the top of the child). Type label: `wayfinder:research|prototype|grilling|task`.
- **Blocking**: GitHub's native issue dependencies — `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` (database id via `gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Fallback: a `Blocked by: #<n>` line at the top of the child body. Unblocked = every blocker closed.
- **Frontier**: open children with no open blocker and no assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n>` with the answer, `gh issue close <n>`, then append a gist + link to the map's Decisions-so-far.
````

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

### issue-tracker.md — Local markdown

````markdown
# Issue tracker: Local markdown

Issues for this repo live as committed markdown files under `docs/issues/`.

## Conventions

- One effort per directory: `docs/issues/<slug>/`
- The spec (when there is one) is `docs/issues/<slug>/spec.md`
- One file per issue: `docs/issues/<slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined file
- Triage state is a `Status:` line near the top of each issue file (role strings from `docs/agents/triage-labels.md`); category is a `Category:` line (`bug` / `enhancement`)
- Conversation history appends under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `docs/issues/<slug>/` (creating directories as needed). When a skill says "fetch the relevant ticket": read the referenced file.

## Wayfinding operations

Used by `/orc:wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `docs/issues/<effort>/map.md` — the Destination / Notes / Decisions-so-far / fog body.
- **Child ticket**: `docs/issues/<effort>/issues/NN-<slug>.md` with a `Type:` line (`research`/`prototype`/`grilling`/`task`) and a `Status:` line (`open`/`claimed`/`resolved`).
- **Blocking**: a `Blocked by: NN, NN` line near the top. Unblocked = every listed file is `resolved`.
- **Frontier**: scan for files that are `open`, unblocked, and unclaimed; lowest number wins.
- **Claim**: set `Status: claimed` before any work.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, then append a gist + link to the map's Decisions-so-far.
````

### triage-labels.md

````markdown
# Triage labels

orc's triage surfaces speak in canonical roles; this table maps them to the label strings actually used in this repo's tracker. Edit the right-hand column to match your vocabulary.

| Canonical role    | Label in this tracker | Meaning                                  |
| ----------------- | --------------------- | ---------------------------------------- |
| `bug`             | `bug`                 | Category: something is broken            |
| `enhancement`     | `enhancement`         | Category: new feature or improvement     |
| `needs-triage`    | `needs-triage`        | Maintainer needs to evaluate             |
| `needs-info`      | `needs-info`          | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent`     | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human`     | Requires human implementation            |
| `wontfix`         | `wontfix`             | Will not be actioned                     |

When a skill mentions a role ("apply the AFK-ready label"), use the corresponding string from this table.
````

### domain.md

````markdown
# Domain docs

How tracker-aware skills consume this repo's domain documentation when exploring the codebase. Layout and maintenance discipline: `orc:domain-modeling`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the ubiquitous-language glossary — or **`CONTEXT-MAP.md`** if it exists (multi-context: it points at one `CONTEXT.md` per context; read the ones relevant to the topic).
- **`docs/adr/`** — ADRs touching the area you're about to work in. Multi-context repos also carry `src/<context>/docs/adr/` for context-scoped decisions.

If any of these don't exist, **proceed silently** — don't flag their absence or suggest creating them; `orc:domain-modeling` creates them lazily when terms or decisions actually get resolved.

## Layout for this repo

[single-context: `CONTEXT.md` + `docs/adr/` at the root | multi-context: root `CONTEXT-MAP.md` + per-context `CONTEXT.md` files]

## Use the glossary's vocabulary

When output names a domain concept (issue title, hypothesis, test name), use the term as `CONTEXT.md` defines it — don't drift to synonyms the glossary avoids. A missing concept is a signal: either reconsider the invented language, or note the gap for `orc:domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
````

## Iron rules

- Never overwrite user edits in `docs/agents/*.md` or the memory file without showing a diff-level preview first.
- Never create labels, issues, or Jira items during setup — this command writes repo config files only.
- Recommend only trackers whose CLI is actually usable here (Phase 1 evidence); never recommend Jira when `acli` is absent or unauthenticated.

## Output

- `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`
- An `## Agent skills` block in `CLAUDE.md` or `AGENTS.md`
- No `.orc/` session state — this is run-once repo configuration with nothing to resume; the written files ARE the durable state.
