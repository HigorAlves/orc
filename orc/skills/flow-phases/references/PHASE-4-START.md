# /orc:flow — Phase 4-START

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


For code work (`feature`, `bug`, `refactor`): invoke `orc:using-git-worktrees` (worktree + branch), then write the first failing test.

In workspace mode, repeat the worktree+branch step for every repo in `targetRepos`. Worktrees live at `${ORC_WORKSPACE_ROOT}/.orc/.worktrees/<repo>/<sanitized-branch>/`. Run the **branch-collision check** for every target repo before creating worktrees:

```bash
for r in $targetRepos; do
  git -C "$ORC_WORKSPACE_ROOT/$r" show-ref --verify --quiet "refs/heads/<branch>"
done
```

| Repo state | Action |
|------------|--------|
| Branch absent locally and on origin | OK — create. |
| Branch absent locally, present on origin | OK — `git fetch && git worktree add -B`. |
| Branch present, points at base HEAD | OK — adopt. |
| Branch present, has divergent commits | **Conflict** — `AskUserQuestion` with the 5 recovery options below. |

Recovery options on conflict (one prompt covering all conflicting repos at once):

1. Suffix all repos with `-2` (or user-chosen short suffix).
2. Suffix only conflicting repos (e.g. `feat/sso-login-api`); keep canonical name elsewhere.
3. Adopt the existing branch (surface divergent commits in the plan-confirmation gate).
4. Pick a different canonical name (restart this step).
5. Abort the flow.

Record any suffix overrides in `checkpoint.md` and `perRepoState[<repo>].branch` so `/orc:resume` and `/orc:ship` know the actual branch per repo.

Then write the first failing test in whichever repo it naturally lives in (per the plan's slice-1 `repo:` tag):

- **Simple first test** (single assertion, single function under test): invoke `orc:tdd` skill inline.
- **Complex first test** (state machine, async coordination, integration boundary, multiple branches): dispatch `orc-test-author` via `Task`. The agent designs a comprehensive suite (happy path + boundary + error paths) using the project's test idioms, runs it, reports.

Test MUST fail with the right message. Commit the failing test in its target repo.

For `--type=docs`: skip; advance to phase 6.

**No gate on a clean red.** The failing run is machine-verified here and re-verified by `orc-implementer` before it goes green — a human confirm on top would rubber-stamp verified state. Print one line and advance to Phase 5:

```
red verified: <test file> — <failure message>
```

Gate only when something is genuinely undecided:

- The failure message doesn't match the expected shape (wrong assertion, import error, framework misconfig) — surface the mismatch, then `AskUserQuestion`: iterate on the test / skip TDD for this work (with rationale; logged to checkpoint) / abort.
- `--pause-at-implement` was passed — the human is about to write the code and seeing red matters to them. Keep the original confirm: test fails as expected / iterate / skip TDD / abort.

