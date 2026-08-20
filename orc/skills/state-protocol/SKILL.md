---
name: state-protocol
description: The canonical .orc/ state contract — orc.json session schema, checkpoint frontmatter + resume-digest shape, the orc-state CLI, read-for-data vs route-from-state, and the resumed-session startup sequence. Use when registering, checkpointing, reading, or resuming .orc/ session state.
---

# State Protocol

One schema, one writer, one startup sequence — defined here and only here. Commands defer to this skill instead of re-spelling state mechanics; `bin/orc-state` is the single writer, so the registry and every checkpoint's frontmatter cannot drift apart.

## The one-writer rule

Never hand-write `.orc/orc.json` or a checkpoint's frontmatter — every mutation goes through `orc-state` (atomic jq writes; registry entry + checkpoint mirror updated by the same verb). The checkpoint **body** below the frontmatter is yours to write freely, except the `## Resume digest` section, which only `orc-state digest write -` touches (it enforces the cap).

Register a session (the 2-line pattern every multi-phase command uses):

```bash
orc-state init --command <cmd> --total-phases <N> [--jira KEY] [--scope workspace --repos a,b] [--plan-file P]
```

> Register state via `orc-state init`; defer to `orc:state-protocol` for schema and rules.

Then per phase boundary: `orc-state phase set <n|done> [--label <word>]`, and rewrite the digest (below). On completion: `orc-state status set completed`.

## Registry schema (`.orc/orc.json`, schema 1)

```json
{ "schema": 1, "sessions": [{
    "sessionId": "feat-142-notifs",        // sanitized branch — THE key; one live session per branch
    "command": "flow", "branch": "feat-142-notifs", "gitBranch": "feat/142-notifs",
    "description": "≤120 chars", "status": "in_progress",
    "phase": 5, "phaseLabel": "implement", "totalPhases": 9,
    "jiraTicket": null, "planFile": null,
    "linkedPRs": [{ "repo": "api", "number": 45, "url": "…", "stackId": null, "stackPosition": null, "stackedOn": null }],
    "startedAt": "2026-08-20T14:03:00Z", "updatedAt": "2026-08-20T18:11:00Z",
    "scope": "workspace", "repos": ["api", "ui"], "perRepoState": { "api": { "repoPath": "…", "branch": "…", "currentSlice": 0, "prUrl": null } }
}]}
```

`status` is a closed enum: `in_progress | paused | completed | abandoned`. `phase` is an integer or the literal `"done"`; flavor text goes in `phaseLabel`. Banned legacy vocabulary (CI-enforced): `session_id`, `current_phase`, `total_phases`, `created_at` — `orc-state migrate` upgrades old registries. Full field reference: [schema.md](references/schema.md).

## Checkpoint schema (`.orc/<sessionId>/files/checkpoint.md`)

YAML frontmatter (machine, mirrored from the registry — never hand-edit) + bounded body (human). Total file ≤4 KB. **History does not live here**: stage tables, PR lists, verification records go to `progress.md` (append-only, uncapped, never read by resume by default).

```markdown
---
schema: 1
command: flow
branch: feat-142-notifs
gitBranch: feat/142-notifs
phase: 5
phaseLabel: implement
totalPhases: 9
status: in_progress
updatedAt: 2026-08-20T18:11:00Z
---

## Resume digest
- Done: phases 1-4 (plan approved; failing test committed abc1234)
- Next: phase 5 — dispatch orc-implementer for slice 2 (slices.json: 1 committed, 3 pending)
- Open decisions: none
- Artifacts: plan.md, slices.json, progress.md
- Suite: green @ abc1234 (58/58)

## Open decisions
(optional, ≤10 lines: pending gate answers, unresolved escalations)
```

**The digest is the handoff artifact.** Five fixed bullets — Done / Next / Open decisions / Artifacts / Suite@sha — rewritten at **every phase boundary** via `orc-state digest write -` (30-line/2 KB cap, tool-enforced). `Next:` must name the exact artifact the next phase reads; `Suite:` must cite the sha the claim was verified at.

## Read-for-data vs route-from-state

- **read-for-data** — looking up fields of an already-known session (`orc-state get [--field jiraTicket]`, `current`). Allowed to every command.
- **route-from-state** — enumerating sessions to decide what to run next (`orc-state sessions [--status]`). Allowed only to `/orc:resume`, `/orc:status`, `/orc:cleanup`, and `/orc:flow`'s self-resume (scoped to its own in-progress session on the current branch).

## Session-startup sequence (every resumed session, in order)

1. Context banner (already injected via `!` preprocessing).
2. `orc-state current` (self-resume) or `orc-state sessions --status in_progress` + picker (`/orc:resume`).
3. Read `checkpoint.md` — bounded by construction.
4. `git log --oneline -10` + `git status --porcelain` in the session's worktree — cross-check the digest's `Suite:`/commit claims against reality; a dirty tree or sha mismatch is surfaced before acting.
5. If `slices.json` exists: `orc-state slice list` → the exact re-entry slice.
6. Read **only** the artifact the digest's `Next:` names. Never enumerate `files/`.
7. `orc-state verify` — any inconsistency is surfaced, not silently repaired.

## Slice ledger + persisted gate inputs

`slices.json` (shape in [schema.md](references/schema.md)) is the `passes: false`-style ledger: status machine `pending → red → green → committed` (+`escalated`/`skipped`), updated via `orc-state slice set`. "All slices done" is a query, not a claim: `orc-state slice list --status pending,red,escalated` exits 0 only when nothing matches.

**Persistence rule:** structured agent output that gates a decision (review findings, stack plans, breakdown JSON, parallel diffs, QA verdicts) is written to `files/` **before** the gate is shown, stamped with `headSha` + `generatedAt` — matching HEAD on re-entry means reuse, not re-dispatch.

## Settled decisions (`decisions.json`)

Per-branch store for answers already given — by a flag, an answered gate, a policy, or a safe inference: `orc-state decision set <key> <value> --provenance flag|asked|policy|inferred` (write-once per key; changing an answer requires `--supersede`), `orc-state decision get <key>`. **Protocol: before any `AskUserQuestion` for a key present in the store, use the recorded value and echo one line — `using settled decision: <key>=<value> (<provenance>)`.** This is how nested commands (flow→plan→qa→ship) stop re-asking what a parent already settled, replacing manual flag-forwarding. Common keys: `autopilotLevel, type, scope, targetRepos, jiraTicket, driver, sizeGate, prMode, cleanupPolicy, trackerDefaults`. Lifetime = the session's branch; `/orc:cleanup` removes it with the rest of `files/`.

## Consumers

Registered by every multi-phase command; the startup sequence is executed by `/orc:resume` and `/orc:flow` self-resume; the ledger by `/orc:plan`, `/orc:flow` Phase 5, `/orc:fan-out`, and `orc-implementer`. A new multi-phase command preloads nothing — it calls `orc-state` and cites this skill.
