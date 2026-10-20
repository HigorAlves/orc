<!-- orc:qa/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Tests and verification

1. Invoke `orc:verification-before-completion`.
2. Run the project's test suite.
3. Run lint and type-check when the project has them.
4. Confirm green output.
5. If any check fails, stop and surface the failure. QA cannot pass.
6. In workspace mode, run all three checks per target repo, in parallel where possible.
7. Aggregate the per-repo results into one verdict.
8. If any repo fails, stop and name the repo and the check.

NOTE: each repo has its own toolchain, so the per-repo runs are independent.
