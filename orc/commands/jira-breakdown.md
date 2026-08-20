---
description: "Turn a feature brief, PRD, or existing Epic into a full Jira hierarchy behind a preview gate. Use when building out a Jira epic/backlog, breaking a feature into Jira tickets, or enforcing the Epic→Story→Task structure."
argument-hint: "[<brief> | <prd-path> | --epic <KEY>] [--project <KEY>] [--team-size <n>] [--dry-run]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(acli:*)
  - Bash(jq:*)
  - Bash(git branch --show-current:*)
  - Bash(git log:*)
  - Bash(date:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:jira-breakdown

A feature is coming and the team needs to swarm it. This command builds the Jira structure that makes that possible — per the `orc:jira-hierarchy` contract (invoke it first; it defines the levels, the micro-PRD sections, the mandatory child template, and the atomization rules). `orc-jira-architect` drafts the hierarchy; nothing is created until you approve the preview.

## Arguments

- Free-form input — a feature brief, a `docs/prds/NNNN-*.md` path, or a plan file. With `--epic`, input is optional (the epic's own description is the material).
- `--epic <KEY>` — attach children to this existing Epic instead of drafting a new one.
- `--project <KEY>` — Jira project. Resolution order: this flag → `docs/agents/issue-tracker.md` (written by `/orc:setup`) → the bound session ticket's project → ask.
- `--team-size <n>` — how many developers will work in parallel (drives atomization aggressiveness; default 3).
- `--dry-run` — stop after the preview; create nothing.

## Workflow

### Phase 0 — Detect + backend preflight

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported — do not re-run detection).

Pick the Jira backend:

1. **Jira MCP tools present in the session** (tool names matching `mcp__*jira*` / `mcp__*atlassian*` with work-item write capability) → prefer them.
2. Else **acli**: invoke `orc:jira-cli`, then `acli jira auth status`. Non-zero → surface the auth-login hint and stop.
3. Neither → stop: point at `orc install` / `acli` setup and `/orc:setup` for tracker config. Never fake a creation.

### Phase 1 — Resolve project + parent Epic

1. Resolve the project key per the order above. Validate `^[A-Z][A-Z0-9_]*$`.
2. Resolve the Epic:
   - `--epic <KEY>` → fetch it (`acli jira workitem view <KEY> --json` or MCP equivalent). It must exist and be **active** (status not Done/Closed/Resolved). Inactive or missing → surface and stop; children never attach to a dead Epic.
   - No `--epic` → search for candidates: JQL `project = <KEY> AND issuetype = Epic AND statusCategory != Done` filtered by input keywords. Then gate:

   ```markdown
   > **⛔ Gate — parent Epic**
   >
   > <N> active Epic(s) match. Children require an active parent — pick one, or draft a new Epic from this material.
   ```

   `AskUserQuestion`: attach to a listed Epic / "Draft a new Epic (micro-PRD) from this input" / cancel.
3. Register state: `orc-state init --command jira-breakdown --total-phases 4` (iron rule #6; schema per `orc:state-protocol`).

### Phase 2 — Dispatch the architect

Dispatch `orc-jira-architect` via `Task` with:

- The feature material (file contents inlined — the agent may lack the conversation's context).
- The Epic decision from Phase 1: existing key + fetched description, or "draft new".
- Project key, allowed issue types if known (`acli jira workitem create` errors reveal them; don't probe preemptively), `--team-size`.

Save the returned JSON verbatim to `${ORC_STATE_DIR}/<branch>/files/jira-breakdown.json`. Bump checkpoint.

If `needs_input` is non-empty, surface every question via `AskUserQuestion` first, fold the answers in, and re-dispatch with them — unanswered gaps do not ship as tickets.

### Phase 3 — Preview gate (mandatory, no bypass)

Run the contract checks from `orc:jira-hierarchy` over the draft — all three template sections on every child, no orphan Stories, parallel groups touchpoint-disjoint. A violation means the draft goes back to Phase 2 with the finding; never "create it and fix it in Jira".

**Persist before the gate**: save the architect's JSON verbatim to `${ORC_STATE_DIR}/<sanitized-branch>/files/jira-breakdown.json` (stamped `generatedAt`, per `orc:state-protocol`) — an interrupted run re-previews or resumes mid-creation from the file without re-dispatching `orc-jira-architect`; track per-ticket creation status in the same file as tickets land.

Then preview:

```markdown
> **📋 Preview — Jira hierarchy for <project>**
>
> 1 Epic (<new | KEY>) · <S> Stories · <T> Tasks/Sub-tasks/Bugs · max parallel: <N>
```

```
EPIC  <summary>                       (micro-PRD: 5/5 sections)
├── S1  <story summary>
│   ├── [Task]     S1-T1  <summary>   group 1   src/orders/export.ts
│   ├── [Task]     S1-T2  <summary>   group 1   src/api/export-route.ts
│   └── [Sub-task] S1-T3  <summary>   ⛓ after S1-T1
└── S2  <story summary>
    └── …
```

`AskUserQuestion`:
- **Create all** — proceed to Phase 4.
- **Edit the draft** — user names changes; apply to the JSON (or re-dispatch for structural edits), re-preview.
- **Trim** — drop named items (dependency links to dropped items are recomputed), re-preview.
- **Cancel** — keep `jira-breakdown.json` on disk for a later run; mark session `abandoned`.

`--dry-run` stops here, echoing the JSON path.

### Phase 4 — Create, bottom-up-safe

Create in dependency order, echoing each real key as it lands:

1. **Epic** (when new): `acli jira workitem create --type Epic --project <KEY> --summary … --from-json` with the micro-PRD as ADF (five headings + content; `orc:jira-cli` § ADF — bare strings destroy the structure). Existing epic with `gaps` reported → offer a one-time description update filling the missing sections (gated).
2. **Stories**: `--type Story --parent <EPIC-KEY>`, description = the three sections as ADF headings + bullets.
3. **Tasks/Bugs** per Story: `--parent <STORY-KEY>` where the project accepts it; on a parenting 400, fall back per the contract — parent to the Epic + `link create --out <STORY> --in <TASK> --type "Relates to"`. **Sub-tasks always carry `--parent <STORY-KEY>`** (an unpaired Sub-task silently becomes the default type).
4. **Dependencies**: `acli jira workitem link create --out <blocker> --in <blocked> --type Blocks --yes` for every `depends_on`.

Any creation failure: stop the batch, report what landed vs. what didn't (with keys), keep the JSON as the retry source — re-running skips items whose keys are already recorded in it.

Finish: write all created keys back into `jira-breakdown.json`, mark the session `completed`, then offer: bind the Epic to this session (`/orc:jira bind <EPIC-KEY>` semantics — `/orc:status`, `/orc:resume`, `/orc:ship` will see it).

## Output

```
✓ Jira hierarchy created — <project>

  Epic:    PLAT-810  <summary>
  Stories: PLAT-811, PLAT-812, PLAT-813
  Tasks:   9 (6 immediately parallel across 3 devs)
  Links:   4 Blocks
  Draft:   .orc/<branch>/files/jira-breakdown.json
```

> **➡️ Next**
>
> Developers pick unblocked Tasks per Story. `/orc:plan --jira <TASK-KEY>` starts one; `/orc:triage` keeps the incoming stream honest.

## Iron rules

- **No child without an active parent Epic.** Verified in Phase 1, enforced again at creation.
- **The three-section template on every child, without exception.** Contract check blocks the batch.
- **Preview gate is mandatory.** No flag bypasses it; `--dry-run` is the only shortcut and it creates nothing.
- **Read the failure, don't retry blind.** acli errors name the real constraint (issue types, required fields) — adapt per `orc:jira-cli`, then continue the batch.

## Related

- `/orc:jira` — single-ticket ops + session binding (this command's primitives).
- `orc:to-issues` — tracker-agnostic slicing of a settled plan; reach for `/orc:jira-breakdown` when the output must be the Epic→Story→Task structure.
- `/orc:setup` — records the tracker + project choice this command reads.
