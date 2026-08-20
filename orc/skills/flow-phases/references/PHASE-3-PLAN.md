# /orc:flow — Phase 3-PLAN

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


For `--type=feature|refactor`: invoke `orc:writing-plans`, optionally `orc:grill-me` if scope ≥ medium. Saves `${ORC_STATE_DIR}/<branch>/files/plan.md`.

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

