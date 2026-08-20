# .orc/ state — full schema reference (schema 1)

Normative field-by-field reference for the shapes summarized in SKILL.md. `bin/orc-state` is the only writer; `scripts/ci/verify-state-protocol.sh` smoke-tests every shape here.

## Registry: `.orc/orc.json`

| Field | Type | Rules |
|---|---|---|
| `schema` | int | Always `1`. Stamped by `init` and `migrate`. |
| `sessions[]` | array | One entry per session. **One live (`in_progress`) session per branch** — `init` on an existing `sessionId` updates in place, never appends. |
| `sessionId` | string | Sanitized branch (`/` and unsafe chars → `-`). THE lookup key. Never a ULID. |
| `command` | string | The registering command (`flow`, `debug`, `ci`, …). |
| `branch` | string | Same as `sessionId` (kept for back-compat reads). |
| `gitBranch` | string | The raw branch name. |
| `description` | string | ≤120 chars. |
| `status` | enum | `in_progress \| paused \| completed \| abandoned`. Closed — `orc-state status set` rejects anything else. |
| `phase` | int \| `"done"` | Flavor text goes in `phaseLabel`, never here. |
| `phaseLabel` | string? | Optional word for the phase (`implement`, `qa`). |
| `totalPhases` | int | Set at `init`; adjust via re-`init` when phases are skipped. |
| `jiraTicket` | string? | `^[A-Z][A-Z0-9_]*-\d+$`, or null. |
| `planFile` | string? | Path to the plan artifact, or null. |
| `linkedPRs[]` | array | `{repo, number?, url, stackId?, stackPosition?, stackedOn?}` via `orc-state link-pr`. |
| `startedAt` / `updatedAt` | string | ISO-8601 UTC. Every mutating verb bumps `updatedAt`. |
| `scope` / `repos[]` / `perRepoState{}` | workspace only | `scope: "workspace"`, target repo names, per-repo `{repoPath, branch, currentSlice, prUrl}`. |

**Banned legacy vocabulary** (grep-banned in commands/agents by `verify-state-protocol.sh` from the migration PR onward): `session_id`, `current_phase`, `total_phases`, `created_at`, `updated_at`. `orc-state migrate` upgrades a legacy registry: `session_id` dropped (sessionId re-derived from branch), `current_phase` → `phase` (int), string `phase` → `phaseLabel`, `total_phases` → `totalPhases`, `created_at` → `startedAt`.

## Checkpoint: `.orc/<sessionId>/files/checkpoint.md`

- Frontmatter: `schema, command, branch, gitBranch, phase, [phaseLabel], totalPhases, status, [jiraTicket], updatedAt` — regenerated from the registry entry on every mutating verb (the mirror). `orc-state verify` fails on any mismatch.
- Body: `## Resume digest` (mandatory; 5 bullets; ≤30 lines / ≤2 KB, enforced by `digest write`) + optional `## Open decisions` (≤10 lines) + anything else ≤4 KB total.
- History (stage tables, PR lists, verification records) belongs in `progress.md` — append-only, never size-capped, never read by resume unless the user asks.

Digest bullets, fixed order:

```
- Done: <phases/slices completed, with shas where claims were verified>
- Next: <phase N — action> (<the ONE artifact the next phase reads>)
- Open decisions: <none | list>
- Artifacts: <files present under files/>
- Suite: <green|red|unknown> @ <sha> (<counts>)
```

## Slice ledger: `.orc/<sessionId>/files/slices.json`

```json
{ "schema": 1, "planPath": "plan.md", "planSha256": "…", "slices": [{
    "id": 1, "title": "POST /export endpoint", "repo": "api",
    "estLoc": 140, "shipsAsStack": false,
    "parallelGroup": 2, "dependsOn": [1],
    "touchpoints": ["src/routes/export.ts", "test/export.test.ts"],
    "acceptance": ["POST /export returns 202 + Location header"],
    "status": "pending", "commit": null, "actualLoc": null, "note": null
}]}
```

- Status machine: `pending → red → green → committed`, plus `escalated` and `skipped` (with `note`). Closed enum — `orc-state slice set` rejects others.
- `planSha256` guards plan/ledger divergence: mismatch at read time → warn + offer regenerate (statuses of slices whose `title` matches are preserved).
- `touchpoints` = files the slice owns (evidence-based); two slices share a `parallelGroup` iff no `dependsOn` edge connects them AND touchpoints are pairwise disjoint; groups execute in ascending order. Same vocabulary `orc-jira-architect` emits for Jira tasks.
- `acceptance` = 2–5 testable criteria per slice (a command to run or an observable behavior — never "works correctly"). Copied from the plan; QA scores against them.
- Completion query: `orc-state slice list --status pending,red,escalated` prints matches and exits 0 **only when nothing matches** — gate "all slices done" on its exit code, never on narrative.

## Persisted gate inputs: `.orc/<sessionId>/files/`

| File | Written by | Before which gate |
|---|---|---|
| `review-findings.json` | `/orc:code-review` after merge+validate | preview/post gate |
| `stack-plan.json` | `/orc:stack-pr --smart` on agent return | stack preview |
| `jira-breakdown.json` | `/orc:jira-breakdown` on agent return | creation preview |
| `slices/slice-NN.diff` + `slice-NN-report.md` | `/orc:flow` Phase 5 parallel collection | apply/commit step |
| `qa-verdict.json` | `/orc:qa` Phase 5 | ship gate |
| `files/qa/qa-manifest.json` | the browser driver, on QA completion | verdict + evidence-publish |

Each carries `headSha` + `generatedAt`. Re-entry with matching HEAD → reuse without re-dispatch; mismatch → offer reuse vs re-dispatch.

`qa-verdict.json` shape — verdict computed mechanically (any `fail` → `fail`; else any `partial` → `partial`; else `pass`; agents never decide it):

```json
{ "schema": 1, "headSha": "abc1234", "generatedAt": "…", "verdict": "pass",
  "checks": [
    { "id": "tests", "kind": "suite", "result": "pass", "evidence": "58/58" },
    { "id": "slice-3-ac-1", "kind": "acceptance", "sliceId": 3,
      "criterion": "POST /export returns 202", "result": "pass", "evidence": "qa/ac-3-1-export-202.png" },
    { "id": "browser-golden-path", "kind": "browser", "result": "partial", "evidence": "qa/steps.md#step-6" }
]}
```

The `kind: "acceptance"` rows are **copied from the packet's `qa-manifest.json`**, never re-derived from prose — `id`, `sliceId`, `criterion`, and `result` map across directly, and `evidence` takes the manifest row's first `evidence` entry.

## Browser-QA packet manifest: `.orc/<sessionId>/files/qa/qa-manifest.json`

Written by whichever browser driver ran (`orc:browser-qa`), and the only machine-readable description of the packet. Callers read it for artifact completeness, publish curation, and acceptance scoring — they do not parse `steps.md`.

```json
{ "schema": 1, "driver": "agent-browser", "generatedAt": "…", "verdict": "pass",
  "artifacts": [{ "file": "screenshot-01-loaded.png", "role": "golden path step 1" }],
  "curated": ["qa-feat-export.webm", "ac-3-1-export-202.png"],
  "acceptance": [
    { "id": "slice-3-ac-1", "sliceId": 3, "criterion": "POST /export returns 202 + Location header",
      "result": "pass", "evidence": ["ac-3-1-export-202.png"], "note": "" }
  ],
  "summary": "Golden path passes. Edge cases pass. No console errors."
}
```

- `driver` enum: `agent-browser` · `chrome`.
- `result` enum: `pass` · `fail` · `skipped`. A `skipped` row MUST carry a non-empty `note` — un-scoreable criteria stay visible rather than silently dropping out of the verdict.
- `evidence` paths are relative to the packet dir. Driver A names an `ac-<sliceId>-<idx>-<slug>.png`; Driver B, which cannot write binary from the session, names `qa-<branch>.gif#step-<N>` pointing at the numbered heading in `steps.md`.
- `curated` is the publish payload — `orc:evidence-publish` takes it verbatim.

## Settled decisions: `.orc/<sessionId>/files/decisions.json`

```json
{ "schema": 1, "decisions": {
    "driver": { "value": "agent-browser", "provenance": "asked", "settledAt": "…" },
    "jiraTicket": { "value": "none", "provenance": "inferred", "settledAt": "…" }
}}
```

- Written only via `orc-state decision set` — write-once per key; `--supersede` required to change an answer (an explicit event, never a silent overwrite).
- `provenance` enum: `flag` (a CLI flag pre-answered it) · `asked` (an answered gate) · `policy` (the interaction-policy ladder chose the default) · `inferred` (derived from config, e.g. no-Jira tracker layer).
- Read rule: before asking a question whose key is settled, use the value and echo `using settled decision: <key>=<value> (<provenance>)`. Readable by nested and sibling commands — it lives in per-branch `files/`, not the registry, so the route-from-state rule doesn't apply.

## Migration notes

Pre-schema-1 state keeps working for reads (`orc-state get` matches on `sessionId` **or** `branch`). Run `orc-state migrate` once per repo to upgrade; checkpoints are upgraded lazily — the next mutating verb regenerates their frontmatter. Nothing else touches historical `files/` artifacts.
