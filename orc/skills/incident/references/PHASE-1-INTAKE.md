<!-- orc:incident/P1 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 1 — Intake and timeline start

1. Run `git branch --show-current`; sanitize the name (`/` to `-`).
2. Create `${ORC_STATE_DIR}/<sanitized-branch>/files/incident/`.
3. Run `orc-state init --command incident --total-phases 5`; schema and rules per `orc:state-protocol`.
4. Create `timeline.md` in that directory from the template below.
5. Classify the input: Sentry issue, pasted stack trace, or described symptom.
6. For a Sentry issue, invoke `orc:sentry-cli` and run the commands below.
7. Capture title, culprit, level, `count`, `userCount`, `firstSeen`, `lastSeen`, the latest stack trace and tags.
8. On a Sentry auth error (exit 10–19), tell the user to run `sentry auth login`.
9. Continue with whatever the user pastes by hand.
10. For a stack trace, identify the throwing frame, the entry point and release markers.
11. `Grep` the repo for the frames to locate the code.
12. For a symptom, ask for the minimum facts: what broke, since when, how noticed.
13. If Sentry is available, offer the search command below.
14. Save the evidence to `${ORC_STATE_DIR}/<branch>/files/incident/evidence.md`.
15. Append a timeline row per pull: what you pulled and what it showed.

Timeline template:

```markdown
# Incident timeline — <slug>

Append-only. One line per action or finding, UTC.

| Time (UTC) | Who | What |
|---|---|---|
| <date -u +%Y-%m-%dT%H:%M:%SZ> | orc | Incident session opened; intake: <sentry issue \| stack trace \| symptom> |
```

NOTE: every later action or finding in any phase appends a row (`date -u +%Y-%m-%dT%H:%M:%SZ`). This is an iron rule: the timeline is what `/orc:postmortem` inherits.

Sentry commands (read `orc:sentry-cli` `references/agent-guidance.md` first, then `references/issue.md` and `references/event.md` as needed; the CLI handles auth and org/project detection):

```bash
sentry issue view <SHORT-ID> --json
sentry issue events <SHORT-ID> --json -n 5
```

Tags to capture: release, environment.

Symptom search: `sentry issue list -q "<terms>" --json --fields shortId,title,level,count,userCount,lastSeen`.

Symptom facts: what is broken, since when, how it was noticed (page, dashboard, customer report).
