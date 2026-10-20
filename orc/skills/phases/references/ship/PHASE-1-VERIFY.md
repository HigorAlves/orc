<!-- orc:ship/P1 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 1 — Pre-ship verification

1. Invoke `orc:verification-before-completion`.
2. Run the tests; verify they pass.
3. If the repo configures lint or type-check, run them; verify they pass.
4. Run `git status --porcelain`; verify no staged-but-uncommitted changes remain.
5. Verify the current branch is not a protected branch.
6. If any check fails, stop and show the failure.
7. In workspace mode, run steps 2–5 per target repo (`cd` into each `repoPath`).
8. If any repo fails, stop and name the repo and the check.

NOTE: after a failure, do not proceed. In workspace mode, push no repo when one fails.
