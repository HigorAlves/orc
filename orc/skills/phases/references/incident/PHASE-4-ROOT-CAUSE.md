<!-- orc:incident/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Root-cause path

1. Dispatch `orc-debug-investigator` via `Task` with the inputs below.
2. Save the returned diagnosis to `${ORC_STATE_DIR}/<branch>/files/incident/diagnosis.md`.
3. Append one timeline row: root cause plus `file:line`.
4. Bump the checkpoint to phase=4.
5. Print `**⛔ Gate — diagnosis**` with one line on the root cause.
6. Ask via `AskUserQuestion` with the three options below.
7. If fixing now, follow `/orc:debug` Phases 4–6 (sequence below).
8. Append test-written, fix-applied and suite-green rows as each happens.

Inputs for the investigator:

- Everything in `${ORC_STATE_DIR}/<branch>/files/incident/evidence.md`: Sentry event JSON, stack trace, blast-radius facts.
- The suspect-deploy correlation from P2 (the `git log` window).
- The current branch and recent commits (`git log -10 --oneline`).

The diagnosis covers: root cause, evidence, recommended fix surface, recommended regression test.

`AskUserQuestion` options:

- "Diagnosis looks right — proceed to fix via /orc:debug discipline (regression test first, then fix)"
- "Need more investigation — re-dispatch with this hint: …"
- "Park it — incident is mitigated; fix ships later via /orc:debug or /orc:flow"

Fix sequence: TDD red regression test, then `orc-code-fixer`, then `orc:verification-before-completion`.
