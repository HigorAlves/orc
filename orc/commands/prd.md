---
description: Author a Product Requirements Document (PRD) — produce a numbered docs/prds/NNNN-*.md following the orc:prd-writing template. Optionally interview-driven and optionally seeded from a Jira ticket.
argument-hint: "[<title>] [--interview] [--from-jira <KEY>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(ls:*)
  - Bash(git:*)
  - Bash(date:*)
  - Bash(acli jira workitem view:*)
  - Bash(jq:*)
---

# /orc:prd

Author a new PRD following `orc:prd-writing`. Lives at `docs/prds/NNNN-<kebab-title>.md`.

## Arguments

- `<title>` — optional. Short noun phrase describing the feature (e.g. "report CSV export"). If omitted, prompts via `AskUserQuestion`.
- `--interview` — optional. Walk the user through the seven-question PRD interview (Problem, Audience, Success metric, In/Out scope, Open questions, Dependencies) before drafting. Default is to draft from existing context only.
- `--from-jira <KEY>` — optional. Pre-seed the PRD's `Problem`, `Linked tickets`, and (if available) `Audience` sections from a Jira ticket via `orc:jira-cli`.

## Workflow

### Phase 1 — Confirm a PRD is warranted

Invoke `orc:prd-writing`. Apply its "all of these are true" test:

- user-facing outcome
- non-obvious intent (real product question)
- non-trivial work (multi-day or coordinated)

If borderline, print the Gate headline (`> [!NOTE]` + `**⛔ Gate — is this PRD-worthy?**`, per `orc:insights`), then `AskUserQuestion`:

- "Yes, write the PRD"
- "Smaller — issue or design note instead"
- "Skip — this is implementation-only; reach for a plan"
- "Refocus — this is technical contract, write a TRD with `/orc:trd`"

### Phase 2 — Locate `docs/prds/`

If the directory doesn't exist, create it and add a one-line `docs/prds/README.md` linking to `orc:prd-writing`. Find the next sequence:

```bash
ls docs/prds 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1
```

Increment to get the new four-digit sequence (`0001` if first).

### Phase 3 — Gather inputs

If `--from-jira <KEY>` was passed, fetch the ticket:

```bash
acli jira workitem view "$KEY" --fields "key,summary,description,assignee,priority,status,labels" --json
```

Use the response to seed:

- `Problem` (from `summary` + `description`)
- `Linked tickets` (the key itself)
- `Audience` (if labels indicate persona — heuristic; user confirms)

If `--interview` was passed, walk the seven-question interview from `orc:prd-writing` (skip questions answered by `--from-jira` or by conversation context). Batch into 2–3 `AskUserQuestion` calls; don't drip one at a time.

### Phase 4 — Draft

Author `docs/prds/NNNN-<kebab-title>.md` using the template from `orc:prd-writing`. Fill every section with real content. **Don't leave `TBD` or placeholder text** — delete sections that genuinely have no content.

### Phase 5 — Review

Print the Gate headline (`**⛔ Gate — PRD review**`), show the draft, then `AskUserQuestion`:

- "Looks good — commit"
- "Edit before commit" (loop back to Phase 4)
- "Save as Draft (Status: Draft)" — commits with status flag flipped

### Phase 6 — Commit + cross-link

Invoke `orc:git-commit`. Suggested message: `docs(prd): NNNN — <title>`.

Surface a hint to the user:

- "Link this PRD from any tracking ticket: `acli jira workitem edit ... --description 'See docs/prds/NNNN-<slug>.md'` (or do it in the Jira UI)."
- If a Jira ticket was bound to the current orc session (`/orc:jira bind`), surface: "Want to link this PRD to bound ticket `<KEY>`? Use `/orc:jira link --in <KEY> --type 'Implements'`."
- If a TRD will follow: "Next step is usually `/orc:trd '<title>' --from-prd NNNN` to pin down the technical contract."

## Output

- New `docs/prds/NNNN-<kebab-title>.md`
- (if absent before) new `docs/prds/README.md`
- One commit
- Echoes path to the new PRD + suggested follow-ups

## Iron rule

PRDs in **Status: Draft** that never get approved are rot. If you draft as Draft, set a follow-up reminder via `AskUserQuestion`: "Revisit in 1 week / 1 month / never (auto-archive)".

## Relationship to `/orc:flow` and `to-prd`

- `/orc:flow` Phase 3 (Plan) does NOT call `/orc:prd` — it expects the PRD to already exist (or doesn't need one for small features). Run `/orc:prd` *before* `/orc:flow` for medium+ features.
- If you've already had the design conversation in chat and just want to ship the artifact to a tracker, reach for `orc:to-prd` directly instead — it's the synthesis-and-publish flow.
