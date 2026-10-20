<!-- orc:incident/P5 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 5 — Stabilize and hand off

1. Declare stable only with the evidence listed below.
2. Append the resolution row to the timeline with the UTC timestamp.
3. Mark the session `status: completed` in `.orc/orc.json`.
4. Bump the checkpoint to phase=done with the paths to `timeline.md`, `evidence.md` and `diagnosis.md`.
5. Print the handoff callout below.
6. Ask via `AskUserQuestion` with the three options below.
7. On "Run now", invoke `/orc:postmortem`; pass the severity so its Phase 2 confirms, not proposes.
8. During its Phase 4, Read the incident `timeline.md` and convert the rows (mapping below).
9. Ask the user only to fill gaps.
10. On "Skip" for SEV-1 or SEV-2, note the declined postmortem in the timeline.

Evidence for "stable": the error rate is back to baseline (`sentry issue view` shows a stale `lastSeen` or a resolvable issue, or the user confirms the dashboard), and a mitigation or fix is in place.

Handoff callout:

```markdown
> **➡️ Next**
>
> Incident stable. Run `/orc:postmortem <slug> --severity <sev-tier>` — its Phase 4 builds the timeline FIRST, and `.orc/<branch>/files/incident/timeline.md` is that timeline, already timestamped. Point it there instead of reconstructing from memory; `evidence.md` and `diagnosis.md` feed its root-cause phase.
```

`AskUserQuestion` options:

- "Run /orc:postmortem now (seeded from the timeline)"
- "Later — the timeline file will be waiting"
- "Skip — no postmortem for this one"

Row mapping into the postmortem timeline table: detection → response → mitigation → resolution.
