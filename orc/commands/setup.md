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

The seed templates live in `orc:tracker-config` (`references/templates/{GITHUB,JIRA,LOCAL,TRIAGE-LABELS,DOMAIN}.md`) — read ONLY the chosen tracker's template plus the labels/domain seeds, fill the bracketed slots, trim sections that don't apply. For "Other" trackers, write `docs/agents/issue-tracker.md` from scratch out of the user's description, keeping the same headings. Every other command reads the written layer through `orc:tracker-config`'s protocol — never re-implement the detection or the missing-config gate here.

## Iron rules

- Never overwrite user edits in `docs/agents/*.md` or the memory file without showing a diff-level preview first.
- Never create labels, issues, or Jira items during setup — this command writes repo config files only.
- Recommend only trackers whose CLI is actually usable here (Phase 1 evidence); never recommend Jira when `acli` is absent or unauthenticated.

## Output

- `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`
- An `## Agent skills` block in `CLAUDE.md` or `AGENTS.md`
- No `.orc/` session state — this is run-once repo configuration with nothing to resume; the written files ARE the durable state.
