<!-- orc:code-review/P4 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 4 — Merge and compute the event

1. Concatenate the `findings` arrays from every agent.
2. Sort by severity priority, then path, then line.
3. Unless `--include-nits`, drop every `nit` finding.
4. Drop any finding whose `path` is not in the diff.
5. Drop any finding with `confidence` below 0.8.
6. Scan each agent `summary` for an approval phrase.
7. If it matches and that agent has a blocking finding, record a Caution for P6.
8. Compute the event with the rule below.
9. Write findings and event to `${ORC_STATE_DIR}/<branch>/files/review-findings.json` with `headSha` and `generatedAt`.
10. In multi-PR mode, tag each finding `[repo:<name>]` and compute one event per PR.

Severity priority: `bug`, `security`, `api-surface`, then `test`, then `suggestion`, `question`, then `nit`.

Approval phrases: approve, lgtm, looks good, no concerns, non-blocking. Case-insensitive. Blocking severities: `bug`, `security`, `api-surface`.

Event rule (`orc:review-contract`):

```
if no findings:                                   APPROVE
elif any severity in {bug, security, api-surface}: REQUEST_CHANGES
elif any severity == test and not --soft-tests:    REQUEST_CHANGES
else:                                              COMMENT
```

NOTE: the findings file is what `/orc:resume` re-enters from. A matching `headSha` means no re-dispatch; a mismatch offers reuse or re-review.
