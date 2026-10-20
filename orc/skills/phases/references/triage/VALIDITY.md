<!-- orc:triage/VALIDITY -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Validity check

Five questions decide whether a report deserves work: is it real (steps 1–3), a duplicate (4), already done (5–6), in scope (7), detailed enough (8)? Step 9 adds a severity. `orc:triage/P2` and `orc:triage/P4` run every step.

> **⚠️ Caution**
>
> Investigate, never fix: no commits, no pushes, no tracker writes, no Sentry writes.

## Steps

1. Reproduce the bug from the reporter's steps, or run the named command.
2. For a stack trace, find each frame in the current code; list frames that no longer exist.
3. For a PR, check out the branch, run the relevant tests, then switch back.
4. Search open tracker items for a duplicate by domain concept, not the report's wording.
5. Run `git fetch origin`, then search `git log origin/main` for the fix or feature.
6. When the work exists on main, run `gh release list --limit 1` and check the release contains it.
7. Read `docs/agents/out-of-scope.md` per `orc:triage/OUT-OF-SCOPE`, and `SCOPE.md` when present.
8. List each fact the next person needs that the report does not give.
9. Assign `sev-1` (production broken now), `sev-2` (broken, workaround exists) or `sev-3`.

NOTE: match duplicates and out-of-scope entries by concept: "night theme" matches a Dark Mode entry.

## Verdict

| Verdict | When | Evidence to print |
|---|---|---|
| valid | real, new, not done, in scope, enough detail | the code path and the reproduction |
| duplicate | an open item covers the same concept | a link to the original |
| already done | main or a release carries the work | the commit, and the release when one carries it |
| out of scope | the KB or `SCOPE.md` rejects the concept | the entry |
| not reproduced | the steps run clean on current code | what ran, and its output |
| needs info | a fact from step 8 blocks the next person | the missing facts |

## Next command

Suggest one command with `**➡️ Next**`. Never start it.

| Condition | Suggest |
|---|---|
| `sev-1` at any verdict | `/orc:incident` |
| valid bug | `/orc:debug` |
| valid enhancement | `/orc:flow` |
| any other verdict | none |
