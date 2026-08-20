# /orc:flow — Phase 6-QA

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


Detect web vs code mode (heuristic on changed files vs main).

**Skip the redundant suite re-run when the evidence is current**: if the ledger shows every slice `committed` AND the digest records `Suite: green @ <sha>` with `<sha>` == current HEAD AND Phase 5 ran sequentially (per-slice suite runs happened on this exact tree), go straight to self-review — the suite verdict is already on record. Re-run `orc:verification-before-completion` (tests + lint + type-check) when any of those fail: sha mismatch, incomplete ledger, or the parallel batch-apply path ran (applied diffs invalidate per-slice evidence). This skip is evidence-keyed, not trust-keyed — one paragraph to revert if recorded evidence ever proves unreliable.

Always invoke `orc:caveman-review` (self-review of diff) — that's a different lens, not re-derivation.

When the diff touches security-sensitive paths (auth, sessions, raw SQL, deserialization, file upload, network egress, dependency surface) — dispatch `orc-security-reviewer` in parallel with the self-review. Merge findings before surfacing.

For web changes, invoke **`orc:browser-qa`** and execute its protocol end-to-end — env attach/provision, the driver gate (`--driver` or a settled `driver` decision skips it), the acceptance-criteria load, then Driver A validator dispatch or Driver B inline. The skill is the single source of truth shared with `/orc:qa` Phase 4; flow adds only the workspace note: the web-surface repo comes from the plan's "Repo touchpoints" (`repoPath = <workspaceRoot>/<that repo>`), cross-repo integration evidence lands at the workspace-level `qa/` dir, repo-local QA stays per-repo. The environment stays up across the QA-partial → fix → re-run loop; teardown happens in Phase 9.

If verification flags untested branches, dispatch `orc-test-author` to fill them in before continuing.

**No gate on a clean pass.** The verdict is computed from the evidence packet, not vibes — when the verdict is `pass` AND the packet is complete, print the verdict line + artifact list and advance to Phase 7. **Completeness is driver-shaped, read from the packet's `qa-manifest.json`** — every file its `artifacts` names exists on disk, and every `acceptance` row is `pass` or a `skipped` carrying a reason. (Do not check for screenshots and a HAR by name: a chrome-driver packet has neither, and hard-coding Driver A's shape here made a clean chrome pass unreachable.) Code mode is unchanged: suite + lint + type-check green.

Gate only on anomaly (verdict `partial`/`fail`, incomplete evidence, or web QA about to be skipped):

```
AskUserQuestion (anomalous QA verdict):
- QA partial — let me address findings, then re-run QA
- QA failed — back to implement
- Skip web QA (with rationale, logged) — only when --no-web justified
- Abort
```

