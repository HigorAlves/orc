# /orc:flow — Phase 3-PLAN

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


## The track decides what this phase produces

Read the settled `track` decision (`orc-state decision get track`) before anything else. Routing table, activation criteria, and the escalate/de-escalate rules: `orc:scale-tracks`.

| Track | This phase produces | Grill |
|---|---|---|
| `quick` | `tech-spec.md` — Change / Approach / Slices (max 3) / Verification. Phase 2 was already skipped. | no |
| `standard` | `plan.md` + slice ledger, via `orc:writing-plans` | `--grill` optional |
| `deep` | `plan.md` + slice ledger, seeded by the Phase 2 RFC | mandatory |

A tech-spec installs the ledger exactly as a plan does (`orc-state slice init`), and `planSha256` hashes `tech-spec.md`. **Downstream phases must not be able to tell which track produced the ledger.**

For `--type=feature|refactor`: invoke `orc:writing-plans`, optionally `orc:grill-me` if the track calls for it. Saves `${ORC_STATE_DIR}/<branch>/files/plan.md` (or `tech-spec.md` on `quick`).

In workspace mode, the plan template MUST include:

1. A **Repo touchpoints** section listing each target repo and what changes there (e.g. `api: new POST /export endpoint`, `ui: download button + progress state`).
2. A **Cross-repo contract** section (when applicable) describing the API/wire-format shape both repos must respect — endpoint paths, schemas, message types. This contract is frozen during Phase 5.
3. A **Merge order** line (e.g. `api → ui`) when there's a deploy ordering dependency. Omit if either order works.
4. Each slice tagged with `repo: <name>` so the Phase 5 dispatcher knows which implementer instance owns it.

For `--type=docs`: invoke `/orc:scaffold` if greenfield, or `orc:documentation-writing` if augmenting existing.

For `--type=bug`: this phase becomes `/orc:debug` instead — dispatches `orc-debug-investigator` to produce `diagnosis.md`. Treat the diagnosis as the plan.

```
AskUserQuestion (after plan drafted):
- Plan looks good — proceed
- Iterate — loop back
- Add --grill stress-test pass
- Decompose into issues (orc:to-issues) — for big plans
- Abort
```

## Track check (after the plan gate, before installing the ledger)

Count the slices and re-test the track against `orc:scale-tracks`:

- **over the ceiling** (`quick` > 3, `standard` > 12), or an override fired during planning (architectural decision, multi-repo, public contract, auth/payments/PII) → print `> **⛔ Gate — track escalation**` and offer escalation. The existing artifact carries forward as the seed; it is never discarded.
- **well under** (`standard` landing at ≤ 3 slices with no override) → offer de-escalation **once**, then drop it.

An accepted change rewrites the `track` decision (provenance `asked`) and records a course change per `/orc:correct-course`. This is the one documented exception to write-once decisions.

## Install the ledger with context packs

On approval, generate `slices.json` per `orc:state-protocol` `references/schema.md`, then populate each slice's `context` pack before `orc-state slice init`:

- `files` — blast-radius ordered. With a graph: `graphify affected "<symbol>"` per touchpoint (`orc:code-discovery`). Without: touchpoints plus their direct importers.
- `symbols` — `name@path:line` the slice must extend or respect.
- `docs` — pointers into the project-context layer, `CONTEXT.md`, and ADRs relevant to this slice. **Pointers, never excerpts.**
- `fixtures` — existing test fixtures/factories to reuse.

A pack is optional (`{}` when discovery was unavailable) and never a substitute for reading the files it names. It exists so `orc-implementer` stops re-deriving the same blast radius on every slice.

