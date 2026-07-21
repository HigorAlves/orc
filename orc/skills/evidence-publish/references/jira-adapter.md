# Jira adapter — evidence delivery

Verified against `acli 1.3.22-stable`. Two capabilities, **two different mechanisms**: comments go through acli; attachments must go through the REST API because acli has no upload verb.

Full acli flag reference lives in `orc:jira-cli` — this file is only the delivery slice.

## Enablement (`detect()`)

```bash
command -v acli >/dev/null 2>&1 || exit 0            # no acli ⇒ tracker disabled
acli jira auth status >/dev/null 2>&1 || exit 0      # not authed ⇒ disabled
SITE=$(acli jira auth status 2>/dev/null  | awk -F': ' '/Site:/{print $2; exit}')
EMAIL=$(acli jira auth status 2>/dev/null | awk -F': ' '/Email:/{print $2; exit}')
TOKEN="${JIRA_API_TOKEN:-${ATLASSIAN_API_TOKEN:-}}"
```

- **comment** tier: `acli` + auth (above). Nothing else.
- **attach** tier: additionally `command -v curl` **and** `TOKEN` non-empty. `SITE`/`EMAIL` come free from `auth status`; only the token is missing (acli never prints its own). Empty `TOKEN` ⇒ attach unavailable, fall back to a comment-only upload and tell the user to set `JIRA_API_TOKEN` to enable attachments.

## Attach a file (`attach()`) — REST v3

`acli jira workitem attachment` exposes only `list` / `delete`. Uploads use the REST endpoint:

```bash
curl -sf -X POST \
  -u "$EMAIL:$TOKEN" \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@<path>" \
  "https://$SITE/rest/api/3/issue/<KEY>/attachments"
```

- `X-Atlassian-Token: no-check` is **required** — Jira's XSRF guard rejects the upload without it.
- One `-F "file=@..."` per call; loop over the curated files.
- Non-2xx (curl exits non-zero under `-sf`) ⇒ surface `<filename>: <status>` and continue to the next file. Partial delivery beats aborting the whole set.

## Post the summary comment (`comment()`) — acli

```bash
acli jira workitem comment create --key "<KEY>" --body-file "<tmp.txt>"
# one-liner form: acli jira workitem comment create --key "<KEY>" --body "<text>"
```

Body is **plain text** (or ADF JSON). Markdown is **not** rendered — `**bold**`, `![img]()`, `#` headings all show literally. Keep it to a short verdict summary and name attachments by filename. Template (write to a scratch file, then `--body-file`):

```
QA evidence — <✅ PASS | ❌ FAIL | ⚠️ PARTIAL>

Golden path: <one line: what was exercised + result>
Edge cases:  <one line, or "n/a — see steps.md">

Attached: <N> file(s) — <comma-separated filenames>.
Full narrative + screenshots: steps.md in .orc/<branch>/files/qa/.
```

## Verify a delivery

```bash
acli jira workitem attachment list --key "<KEY>" --json | jq -r '.[].filename'
acli jira workitem comment list    --key "<KEY>" --json | jq -r '.[-1].body' | head
```

## Notes / pitfalls

- **Do not paste real ticket keys into committed examples** — use `PROJ-123` placeholders (same rule as `orc:jira-cli`).
- **The token is a secret.** Read it from the env only; never echo it, never write it into `steps.md` or any committed file.
- Uploading is an **outward-facing action on the user's real tracker** — it only ever runs after the SKILL.md preview gate returns "Upload", never on detection alone.
