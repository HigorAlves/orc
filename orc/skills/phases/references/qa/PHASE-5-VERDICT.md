<!-- orc:qa/P5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 5 — Write the verdict

1. In web mode, Read `orc:qa/PACKET` and check every required artifact exists.
2. If a required artifact is missing, print the Blocked callout from `orc:qa/PACKET` and stop.
3. Write `qa-verdict.json` at the path below, shape per `orc:state-protocol` `references/schema.md`.
4. Add one `checks[]` row per suite check, per slice acceptance criterion, per browser walk.
5. Copy the acceptance rows from the packet's `qa-manifest.json` `acceptance[]`; never re-derive them from prose.
6. Mark an un-scoreable criterion `result: "skipped"` with the manifest's `note`, visibly.
7. If the manifest is missing or a criterion lacks a result, record incomplete evidence.
8. Compute the `verdict` with the rule below.
9. Stamp `headSha` and `generatedAt`.
10. Append the QA block below to `.orc/<branch>/files/progress.md`.
11. Run `orc-state phase set <n> --label qa-complete`, then `orc-state digest write -`.

Verdict path: `${ORC_STATE_DIR}/<sanitized-branch>/files/qa-verdict.json`.

Acceptance row shape: `kind: "acceptance"`; `evidence` is the manifest row's first `evidence` entry. Suite checks: tests, lint, type-check.

Verdict rule (mechanical; agents never decide it; ship and flow gates read this file):

```
any check fail     → fail
else any partial   → partial
else               → pass
```

Progress block:

```
## QA — <ISO-timestamp>
- Tests: pass/fail
- Lint: pass/fail
- Type-check: pass/fail
- Self-review findings: <count>
- Env: <ready (reused) | ready (booted <N>s) | fallback (host) | skipped>
- Browser QA: <pass|fail|partial|skipped (code-only)>
- Artifact dir: .orc/<branch>/files/qa/  (if web mode)
```

NOTE: incomplete evidence is never a pass. The state calls follow `orc:state-protocol`.
