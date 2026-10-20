<!-- orc:triage/P1 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 1 — Attention queue

1. Query the tracker for the three buckets below, oldest first.
2. Print each bucket with its count and a one-line summary per item.
3. When PRs are in scope, tag each item `[PR]` or `[issue]`.
4. Surface only external PRs; the tracker config defines external.
5. Let the maintainer pick an item, then Read `orc:triage/P2`.

Buckets:

1. Unlabeled — never triaged.
2. `needs-triage` — evaluation in progress.
3. `needs-info` with reporter activity since the last triage notes — needs re-evaluation.

NOTE: a collaborator's in-flight PR is not triage work. The external filter is discovery-only; a named PR always enters triage.
