<!-- orc:plan/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Confirm with the user, install the slice ledger

This gate asks at every autopilot level when `/orc:plan` runs standalone: the plan is the command's deliverable. Inside `/orc:flow` at `full`, the flow's contract gate IS the approval.

## Gate

1. Print the Gate headline `**⛔ Gate — plan review**`.
2. Ask with `AskUserQuestion`, header `Plan`, the two options below.
3. On "Iterate", return to `orc:plan/P2`.

Options (`orc:gates` §3):

- `Looks good — proceed (Recommended)`: its `preview` is the slice table with `#`, title, `est_loc`, `parallel_group`, `depends_on`.
- `Iterate — revise plan`: what to change rides the notes.

## Ledger

4. On approval, parse the approved plan's slice headers into `slices.json`.
5. Set every slice `status: "pending"` and `planSha256` to the sha of `plan.md`.
6. Install it: `orc-state slice init <file>`.
7. On re-approval after iteration, regenerate the ledger.
8. Preserve the status of each slice whose `title` still matches.

Slice header fields (per `orc:writing-plans`): `est_loc`, `repo`, `ships_as_stack`, `touchpoints`, `parallel_group`, `depends_on`, `acceptance`. Ledger shape per `orc:state-protocol` `references/schema.md`.

NOTE: consumers (`/orc:flow` Phase 5, `/orc:fan-out`, `orc-implementer`) read the ledger, not the prose. "All slices done" means `orc-state slice list --status pending,red,escalated` exits clean.
