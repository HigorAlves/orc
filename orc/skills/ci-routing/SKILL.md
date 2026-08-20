---
name: ci-routing
description: The canonical route-on-verdict protocol for a red CI diagnosis — fixable/flake/infra/needs-debug handling, the single-render rule, and the fix-then-re-watch loop. Use after orc-ci-investigator returns; /orc:ci Phase 3 and /orc:flow's post-open CI gate delegate here.
---

# CI Routing

The single source of truth for acting on an `orc-ci-investigator` diagnosis — `/orc:ci` and `/orc:flow`'s post-open CI gate both execute this protocol instead of restating it. Input: the diagnosis (verdict + evidence table + fix list), already saved verbatim to `${ORC_STATE_DIR}/<branch>/files/ci-diagnosis.md`.

**Single-render rule:** the diagnosis is saved via `Write` — never echoed wholesale into conversation. It gets ONE capped rendering: the fix list + one evidence line per root cause + the file path. Every later step references the saved file; quotes are capped at 3 evidence lines.

## `green`

Say so — one line, run ID cited. Mark the session step complete and stop.

## `fixable`

Render the one preview (`> **📋 Preview — CI fix list**`: N root causes across M jobs, then the numbered `<file>:<line> — <change> — clears <job>` list), then `AskUserQuestion` — **one call, two questions** (the landing decision is collected up front, so a green fixer report lands without a second stop):

1. **Apply the fix list?** — Apply (dispatch `orc-code-fixer` with the fix list + diagnosis path; it applies edits, runs tests, returns a diff + test summary) / Edit the list first / This needs real debugging (jump to `needs-debug`) / Abort.
2. **After a green fixer report, land it how?** (ignored unless the fixer ran and came back green) — Commit + push + re-watch (Recommended: `orc:git-commit`, `git push`, re-watch the run until it concludes) / Commit only / Show me the diff first.

Red fixer report → discard the landing answer and return the new evidence to the investigator (it sees the failed attempt) — or offer the `needs-debug` hand-off. Loop until green or the user explicitly advances with red CI (logged to the digest).

## `flake`

Quote up to 3 run-history evidence lines proving intermittency, then `AskUserQuestion`: Re-run failed jobs (`gh run rerun <id> --failed`, then watch) / Re-run everything / Not convinced — treat as fixable or needs-debug / Skip.

## `infra`

No code changes to make. Surface the diagnosis path + the agent's recommendation (pin the action version, report to the platform team, wait out the outage) with its capped evidence. Offer a re-run only when the agent recommended one.

## `needs-debug`

The failure needs root-cause work beyond the diff:

```markdown
> **➡️ Next**
>
> Genuine regression — run `/orc:debug` seeded with the CI diagnosis at `.orc/<branch>/files/ci-diagnosis.md`.
```

`AskUserQuestion`: Start `/orc:debug` now (diagnosis pre-seeded as the bug description — its investigator starts from the CI evidence instead of zero) / I'll run it later / Abort.

## Iron rules

- **No fix without the investigator's diagnosis.** The fixer only ever receives an evidence-cited fix list — never "CI is red, go fix it".
- **Re-runs are gated.** `gh run rerun` only after the flake evidence is shown and the user confirms.
- **Never `git push --force`** — a red pipeline is not a license for history rewrites.
