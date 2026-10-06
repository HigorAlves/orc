# GitHub PR adapter — evidence delivery

Posts ONE comment on the branch's open PR: verdict table + links. GitHub has no API to upload a video into a comment, so media is linked (private Artifact URL recorded in `steps.md`, or "kept local").

## detect()
```bash
command -v gh >/dev/null 2>&1 || exit 0
gh auth status >/dev/null 2>&1 || exit 0
PR_JSON="$(gh pr view --json number,url 2>/dev/null)" || exit 0     # no PR for this branch ⇒ disabled
PR_NUMBER="$(printf '%s' "$PR_JSON" | jq -r .number)"; PR_URL="$(printf '%s' "$PR_JSON" | jq -r .url)"
```
`comment: true` when all three succeed; `attach: false` always (links only).

## comment()
```bash
body="$(mktemp)"
{
  printf '## QA evidence — %s\n\n' "$(jq -r '.verdict | ascii_upcase' "$QA/qa-manifest.json")"
  printf '| Criterion | Result | Evidence |\n|---|---|---|\n'
  jq -r --arg art "${ARTIFACT_URL:-}" '.acceptance[] | "| \(.criterion) | \(.result)\(if .note != "" and .note != null then " — " + .note else "" end) | \(if $art != "" then "[" + (.evidence[0] // "-") + "](" + $art + ")" else (.evidence[0] // "-") end) |"' "$QA/qa-manifest.json"
  printf '\n'
  jq -r '"Driver: \(.driver)" + (if .target then " · target `\(.target.name)`" + (if .target.guard then " (read-only)" else "" end) else "" end)' "$QA/qa-manifest.json"
  [ -n "${ARTIFACT_URL:-}" ] && printf '\nRecording + report: %s\n' "$ARTIFACT_URL"
  [ -n "${EXPLAINER_URL:-}" ] && printf 'Explainer: %s\n' "$EXPLAINER_URL"
  jq -r 'if (.specs // []) != [] then "Specs: " + (.specs | map("`" + . + "`") | join(", ")) else empty end' "$QA/qa-manifest.json"
  printf '\n<sub>Full packet: `.orc/<branch>/files/qa/` (local).</sub>\n'
} > "$body"
gh pr comment "$PR_NUMBER" --body-file "$body"
```
Markdown renders on GitHub (unlike Jira). Never paste console/HAR content. Never include credentials or `ORC_TARGET_JSON`; never echo a token.

## Idempotency
`steps.md` records `- PR comment: posted <url>`; a second run offers **Update** = post a new comment prefixed `Updated QA evidence` (GitHub comment edit needs the comment id — `gh pr comment --edit-last` works when the last comment is ours; prefer it).
