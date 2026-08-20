# Comments + attachments


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
