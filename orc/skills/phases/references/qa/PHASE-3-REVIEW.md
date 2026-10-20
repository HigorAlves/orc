<!-- orc:qa/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Self-review, security pass

1. Invoke `orc:caveman-review` on the staged or last-commit diff.
2. If the diff touches a security-sensitive path, dispatch `orc-security-reviewer` in parallel.
3. Merge the security findings with the caveman findings.
4. Surface the merged findings to the user.
5. If P2 verification flagged untested branches, dispatch `orc-test-author`.
6. Pass it the under-tested function or behavior and the project's test idioms.
7. If the new tests surface failures, return to `orc:qa/P2`.

Security-sensitive paths: auth, sessions, raw SQL, deserialization, file upload, network egress, dependency surface. Same auto-detection as `/orc:code-review`.

NOTE: `orc-security-reviewer` returns a security finding list. `orc-test-author` writes the tests, runs the suite and returns a report.
