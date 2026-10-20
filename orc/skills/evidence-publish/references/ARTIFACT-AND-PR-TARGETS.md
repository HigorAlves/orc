# Artifact and PR targets

The two targets beyond the tracker: a private Artifact of the QA report and a PR comment. Read this when step 1 of [SKILL.md](../SKILL.md) found either target available; it extends the preview gate (step 3) and the deliver step (step 4). Detection stays in SKILL.md.

## Preview gate — extra questions

Artifact target available ⇒ the same `AskUserQuestion` call carries a second question (header `Publish`): **Publish the QA report as a private Artifact?** — `Keep local (Recommended)` / `Publish privately` (preview: the report's criteria list + the files it would upload). With no tracker target it is the only question. A prior `Report: artifact <url>` line in `steps.md` ⇒ offer `Update that artifact` instead of a second URL.

**PR target available** ⇒ the call gains a further question (header `Post`): **Post QA summary to PR #<n>?** — `Keep local (Recommended)` / `Post comment` (preview: the comment body). Only asked when a PR exists; hard-outward, so `--auto` never answers it. Order in the call: Jira upload → Artifact → PR comment, so the Artifact URL can land in the comment — when the user picks Artifact publish and PR post together, publish first, then build the body with `ARTIFACT_URL`.

## Deliver

- **Artifact** (on Publish): publish `qaDir/report.html` with the `Artifact` tool (new artifact: `icon: checklist`; update: pass the recorded `url`). Upload only the **image/video** files the report references and that exist — `orc-report json | jq -r '[.artifacts[].file, .acceptance[].evidence[]] - .missing | map(sub("#.*"; "")) | unique | .[] | select(test("\\.(png|jpe?g|gif|webp|webm|mp4)$"; "i"))'` — as `files`, each published at its bare filename so the report's relative paths resolve. Never include `*.log`, `*.har`, `*.zip`, `*.txt`, `*.json`, or anything under `pw/` — a Playwright `trace-*.zip` holds the session cookie and response bodies, and the Artifact link travels with the PR comment. It stays private; linking it from a PR or ticket is a separate, asked step.

- **PR comment** (on Post): run `comment()` from [github-pr-adapter.md](github-pr-adapter.md). Markdown is fine on GitHub; links only, no media upload.
