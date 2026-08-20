# /orc:flow — Phase 2-RFC

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


If triage flagged "1–4 weeks" or `--rfc` was passed, invoke the RFC sub-flow (same logic as `/orc:rfc`). Saves to `.orc/<branch>/files/rfc-NNNN.md` workspace draft, optionally commits to `docs/rfcs/NNNN-*.md`.

```
AskUserQuestion (after RFC drafted):
- RFC looks good — proceed to plan
- Iterate on RFC — loop back
- Pause here — RFC is the deliverable for now (mark flow as completed)
- Abort the whole flow
```

