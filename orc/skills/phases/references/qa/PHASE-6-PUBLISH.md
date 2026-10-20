<!-- orc:qa/P6 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 6 — Publish evidence (web mode, optional)

1. If P4 produced no packet (code mode), skip this phase.
2. Invoke `orc:evidence-publish` with the inputs below.
3. Let the skill ask: upload the evidence to the ticket, or keep it local.
4. Confirm the skill recorded the outcome in `steps.md`.

Inputs:

- `qaDir = ${ORC_STATE_DIR}/<sanitized-branch>/files/qa/`
- the browser-QA `verdict`
- the session's bound `jiraTicket`, when it has one

NOTE: the skill detects tracker enablement and curates the visual proof. With no tracker bound or no auth it degrades to a one-line "kept local" note, so running it in every web-mode run is safe.
