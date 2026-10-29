<!-- orc:triage/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Quick state override

Reached by "Move #42 to ready-for-agent" and similar: trust the maintainer and apply directly.

1. Skip context gathering and grilling.
2. Print `**📋 Preview — tracker writes**`: role changes, comment, close.
3. Ask via `AskUserQuestion` to confirm, then act.
4. When moving to `ready-for-agent` without a grilling session, ask whether to write an agent brief.

NOTE: the brief template is in `orc:triage/BRIEFS`.
