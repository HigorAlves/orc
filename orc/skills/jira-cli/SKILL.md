---
name: jira-cli
description: "Atlassian CLI (acli) reference for Jira work items — create, sub-task, link, view, JQL search, transition. Use to file/move/link a Jira ticket from the terminal or when /orc:jira is invoked."
---

# Jira CLI (acli)

This SKILL.md is a thin index — Read the relevant `references/*.md` on demand, never all up front. Reference for Atlassian's `acli`, used by `/orc:jira`, the Jira-link prompts in `/orc:plan|debug|flow`, and `/orc:ship`'s `Resolves <KEY>` trailer. **Verified version:** acli 1.3.18-stable (2026-05-02).

## Iron rule: ADF JSON for rich bodies on Jira Cloud

Jira Cloud stores rich-text fields (descriptions, comments) as **ADF JSON** — it renders neither Markdown nor wiki markup; `**bold**` and `h3. Title` arrive as literal characters. A bare `--summary` / one-paragraph `--description` string is fine (acli wraps it); anything richer — headings, lists, tables, code blocks, links — is ADF or nothing, passed via `--description-file ./body.adf.json`. Renaming a `.md` file to `.json` does not make it ADF. Full skeleton, node cheatsheet, and invariants: [ADF.md](references/ADF.md).

## Auth pre-flight

`acli jira auth status` must exit 0 before any mutating command; on failure re-run `acli jira auth login --web` — never debug a 401. Install + token/CI auth flows: [SETUP.md](references/SETUP.md).

## Verb map

| Task | Command shape | Detail |
|------|--------------|--------|
| Create ticket | `acli jira workitem create --summary S --project P --type Task [--json]` | [CRUD.md](references/CRUD.md) |
| Sub-task | same + `--type "Sub-task" --parent KEY` | [CRUD.md](references/CRUD.md) |
| Link tickets | `acli jira workitem link create --out A --in B --type Blocks --yes` | [CRUD.md](references/CRUD.md) |
| View | `acli jira workitem view KEY [--fields …] [--json] [--web]` | [CRUD.md](references/CRUD.md) |
| Search (JQL) | `acli jira workitem search --jql "…" [--limit N] [--json\|--csv\|--count]` | [CRUD.md](references/CRUD.md) |
| Transition | `acli jira workitem transition --key KEY --status "In Progress" [--yes]` | [CRUD.md](references/CRUD.md) |
| Comment | `acli jira workitem comment create --key KEY --body "…"` | [COMMENTS-ATTACHMENTS.md](references/COMMENTS-ATTACHMENTS.md) |
| Attach file | **no CLI verb — REST upload** (`X-Atlassian-Token: no-check`) | [COMMENTS-ATTACHMENTS.md](references/COMMENTS-ATTACHMENTS.md) |

For the full QA-evidence flow (curation, preview gate, local fallback) use `orc:evidence-publish` — it drives these commands.

## Pitfalls (the ones that actually bite)

- `--type` is case-sensitive (`task` ≠ `Task`); a 400 on create is usually casing.
- Sub-task without `--parent` silently creates the project's default type instead.
- `link create --type` rejected → site has custom link types: `acli jira workitem link type`.
- `transition --status` must match the target status name exactly; unreachable transitions fail — inspect the workflow before retrying.
- A 401 after weeks of working commands = token rotation, not a bug. Re-auth.
- Never paste real ticket keys into committed examples — placeholders (`PROJ-123`) only.
- Markdown/wiki markup in bodies renders literally — see the ADF iron rule.

## Using with orc

Prefer `--json` piped through `jq` for deterministic parsing. Recurring patterns: capture `.key` after create then `/orc:jira bind <KEY>`; read the summary for branch naming (`/orc:start --jira`) via `view --fields "summary" --json | jq -r '.fields.summary'`, slugified. Gate both on `acli jira auth status`.

`acli jira workitem <verb> --help` self-documents anything not covered. JQL reference: https://support.atlassian.com/jira-software-cloud/docs/jql-fields/ · Getting started: https://developer.atlassian.com/cloud/acli/guides/how-to-get-started/ · Siblings: `orc:gh-cli`, `orc:sentry-cli`.
