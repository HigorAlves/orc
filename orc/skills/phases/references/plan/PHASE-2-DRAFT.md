<!-- orc:plan/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Draft the plan

1. Invoke `orc:writing-plans` and follow that skill exactly.
2. Write the output to `${ORC_STATE_DIR}/<branch>/files/plan.md`.
3. Give every slice header an `est_loc: <int>` field, per the contract below.
4. If a slice's estimate exceeds the budget, split it further or mark it `ships_as_stack: true`.
5. When a Graphify graph exists, sharpen `modified_files` with `graphify affected "<symbol>"` blast radius.
6. Flag high-fan-in changes as `ships_as_stack: true` before implementation.
7. When `targetRepos` has 2+ entries, add the workspace sections below to the plan.
8. Update `checkpoint.md` (phase=2, last_artifact=plan.md).

## Per-slice LOC budget contract (all modes)

The estimate is the implementer's contract, not a precise prediction.

- Heuristic: `est_loc ≈ (new_files * 80) + (modified_files * 30) + boilerplate_test_lines`. Adjust for known-large files.
- Budget: `${ORC_PR_LOC_BUDGET:-300}`; resolution order and exclusion list per `orc:pr-size-budget`.
- `ships_as_stack: true` signals that the implementer invokes `/orc:stack-pr` at ship time.
- In flow Phase 5, a slice whose diff exceeds `est_loc * 1.5` escalates instead of ballooning silently (`orc-implementer` escalation conditions).

## Workspace mode plan additions (2+ target repos)

1. Repo touchpoints — each target repo and the changes it owns:
   ```markdown
   ## Repo touchpoints
   - api: new POST /export endpoint with row-streaming
   - ui:  download button + progress state + error toast
   ```
2. Cross-repo contract — when slices span repos, freeze the API or wire-format shape:
   ```markdown
   ## Cross-repo contract
   - HTTP: POST /api/export, body `{ filterId: string }`, returns 202 + Location header
   - Stream: chunked CSV with header row first; ETA in custom `X-Stream-Eta` header
   ```
   Both sides respect it. The contract is frozen during flow Phase 5; implementers never change it unilaterally.
3. Merge order (optional) — when a deploy dependency exists:
   ```markdown
   ## Merge order: api → ui
   ```
4. Per-slice `repo:` tag — each slice declares its owning repo:
   ```markdown
   ### Slice 3 — POST /export endpoint
   - repo: api
   - files owned: src/routes/export.ts, test/export.test.ts
   - est_loc: 140
   - …
   ```

NOTE: the flow Phase 5 dispatcher reads `repo:` to fan out implementers per repo and `est_loc:` to enforce the per-slice budget contract.
