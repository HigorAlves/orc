---
description: "Live incident response — intake a Sentry issue, stack trace, or symptom; gate mitigate-first vs root-cause-first; keep a UTC timeline. Use when production is broken RIGHT NOW; for the after-action write-up alone, use /orc:postmortem."
argument-hint: "[<sentry-issue-id-or-url> | <pasted stack trace> | <symptom>] [--severity sev-1|sev-2|sev-3]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(sentry:*)
  - Bash(jq:*)
  - Bash(date:*)
  - Bash(git log:*)
  - Bash(git branch --show-current:*)
  - Bash(git diff:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:incident

Run an incident while it happens: triage the evidence, size the blast radius, choose mitigate-first or root-cause-first, and keep a UTC timeline that becomes the postmortem's spine. Stop the bleeding before you study the wound; `/orc:postmortem` learns from the incident afterwards.

## Arguments

- First argument (free-form) — a Sentry issue short ID or URL, a pasted stack trace, or a described symptom.
- `--severity sev-1|sev-2|sev-3` — optional. Skips the severity proposal in P2; P2 still assesses the blast radius.

NOTE: a Sentry short ID looks like `PROJ-123`; `orc:sentry-cli` pulls it live. A symptom reads like "checkout is 500ing since the 14:00 deploy".

## Preconditions

> **🛑 No production mutations**
>
> P3 previews rollbacks, flag flips and scaling calls; the user executes them. orc records; the human acts.

- A `loose` context stops the run in Phase 0: there is no state dir to write.
- Every action or finding in any phase appends a UTC row to `timeline.md` in the same turn.
- Timestamps come from `date -u +%Y-%m-%dT%H:%M:%SZ`.

## Phases

Modules live in `orc:phases` (`references/incident/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Intake and timeline start | `orc:incident/P1` | never |
| 2 Assess, then the strategy gate | `orc:incident/P2` | never |
| 3 Mitigate-first path | `orc:incident/P3` | the gate picks root-cause-first |
| 4 Root-cause path | `orc:incident/P4` | the user parks the root cause after P3 |
| 5 Stabilize and hand off | `orc:incident/P5` | never |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; it exports `ORC_*` vars. Do not re-run detection.
2. If the context is `loose`, print that and stop.

NOTE: the gate in P2 routes "Mitigate first" to P3, "Root-cause first" to P4, and "Both in parallel" to P4 while the user's manual mitigation steps land in the timeline as reported.

## Iron rules

- Timeline or it did not happen: every pull, finding, mitigation and verification appends a UTC row in the same turn.
- Never batch timeline rows at the end from memory.
- No production mutations, ever, even when every binary is available.
- Deploys, flag flips and scaling get a 🛑 preview; the user executes them. orc records.
- No "stable" claim without evidence: a fresh Sentry read or an explicit user confirmation, recorded in the timeline.
- Mitigation is not resolution. After mitigate-first, always offer the root-cause path before closing.

## Output

- `.orc/<branch>/files/incident/timeline.md` — append-only UTC timeline, the postmortem seed.
- `.orc/<branch>/files/incident/evidence.md` — Sentry data, stack trace, blast radius.
- `.orc/<branch>/files/incident/diagnosis.md` — when the root-cause path ran.
- `.orc/<branch>/files/checkpoint.md` plus the session entry in `.orc/orc.json`.
- Regression test and fix commits, when fixing during the incident.
- Echoes: severity, blast radius, mitigation status, and the `/orc:postmortem` handoff line.

NOTE: on interruption, `/orc:resume` reads the checkpoint and continues from the next pending phase. A resumed session re-reads `timeline.md` before acting; the file carries the full history.
