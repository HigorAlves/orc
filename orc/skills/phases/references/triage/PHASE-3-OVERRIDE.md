<!-- orc:triage/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Quick state override

Reached by "Move #42 to ready-for-agent" and similar: trust the maintainer and apply directly.

1. Skip context gathering and grilling.
2. Print `**📋 Preview — tracker writes**`: role changes, comment, close.
3. Ask via `AskUserQuestion` to confirm, then act.
4. When moving to `ready-for-agent` without a grilling session, ask whether to write an agent brief.

5. Target is `ready-for-agent` and `factory.machineUrl` is set: add the option "Send to the factory" to the SAME `AskUserQuestion` as step 3.
6. Name the exact call in its description: `POST <machineUrl>/tasks for #<n>`.
7. This is a hard-outward gate (`Tracker` chip). It always asks, at every policy level, including `--auto`.
8. On yes, build the body with `jq` from `gh issue view <n> --json title,body,url` and `gh repo view --json nameWithOwner`. Never string-interpolate the body.
9. Set `criteria` to the body's `- [ ] …` and `- [x] …` items, trimmed.
10. Set `repoPath` to `git rev-parse --show-toplevel`, or null in workspace mode when ambiguous.
11. Run ONE call: `curl -sS -X POST <machineUrl>/tasks -H 'content-type: application/json' --data @-`.
12. Body: `{title, description, criteria, repoPath, source: {kind: "github", repo: "<owner/name>", number: <n>, url: "<html url>"}}`.
13. On HTTP 2xx, print `➡️ sent to the factory: task <id> (<machineUrl>)`. Post nothing to GitHub beyond the approved label move.
14. On failure, print the HTTP status and the machine's `{error, message}` body. Leave the label move in place.

NOTE: the factory may also poll the label (Hardness `MACHINE_GITHUB_POLL`). Sending twice is harmless: the machine de-duplicates on `source`.

NOTE: the brief template is in `orc:triage/BRIEFS`.
