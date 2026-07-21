# Tracker adapter contract

`evidence-publish` is tracker-agnostic. Each adapter implements four operations; the SKILL.md protocol is written against **these**, not against Jira. Shipped adapters: **jira** (`jira-adapter.md`). GitHub Issues / Linear are added by writing a sibling reference file — no protocol change.

| Op | Signature | Jira implementation |
|----|-----------|---------------------|
| `detect()` | → `{ comment: bool, attach: bool, site?, email? }` | `acli jira auth status` (comment) + `JIRA_API_TOKEN` present (attach) |
| `resolveTicket()` | → `{ key, url }` \| none | explicit key, else `.orc/orc.json` `jiraTicket` for the active session |
| `attach(key, files[])` | → per-file ok/err | REST `POST /issue/{key}/attachments` (acli has no upload verb) |
| `comment(key, text)` | → ok/err | `acli jira workitem comment create --key --body-file` |

## Contract rules

- **Two-tier capability.** `detect()` reports `comment` and `attach` **independently** — a tracker may support one and not the other (Jira: comment via CLI whenever authed; attach only with an API token). The protocol degrades per tier; a comment-only upload is valid.
- **Never throw on absence.** A missing CLI / auth / ticket returns "disabled", never an error — the caller falls back to local-only.
- **Plain text in, adapter formats out.** Callers pass plain text; the adapter converts to the tracker's native format (Jira: plain/ADF — never markdown).
- **A URL for the preview.** `resolveTicket()` returns a browsable URL so the preview gate can show where evidence will land.

## Adding an adapter

1. Write `references/<tracker>-adapter.md` with the four ops as runnable commands.
2. Extend `detect()`'s selection — e.g. a GitHub adapter keys off `gh auth status` (via `orc:gh-cli`) plus an issue number resolved from the branch/PR, and implements `attach` by uploading images to an issue comment.
3. Leave SKILL.md untouched — its protocol targets this contract, not any one tracker.
