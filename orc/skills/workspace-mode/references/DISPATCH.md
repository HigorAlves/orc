# Per-repo dispatch and branch-name collisions

Disclosed from `orc:workspace-mode`. Read when dispatching code-touching agents per repo (`/orc:flow` Phase 5) or when `/orc:start` / `/orc:flow` Phase 4 creates the branch across target repos.

## Per-repo agent dispatch

Code-touching agents accept these new inputs in workspace mode:

| Input | Meaning |
|-------|---------|
| `repo` | Repo name (e.g. `api`). |
| `repoPath` | Absolute path to the repo's worktree. |
| `siblingRepos` | List of names — awareness only; do NOT touch. |
| `crossRepoContract` | Optional pointer to a plan.md section describing the API/wire-format contract between repos. Frozen during implementation. |

Agents updated: `orc-implementer`, `orc-code-fixer`, `orc-test-author`, `orc-pr-reviewer`, `orc-qa-validator`, `orc-debug-investigator`.

**Dispatch pattern**: one implementer per repo, in parallel. Repo boundary is a stricter form of the parallel-safe slice boundary already in `agents/orc-implementer.md` — sibling implementers literally cannot touch each other's files because their worktrees are different directories. Per-repo toolchains and failure isolation argue for per-repo dispatch over a single iterating invocation.

The orchestrator (`commands/flow.md` Phase 5) groups slices by `repo:` tag, then within each repo applies the existing sequential/parallel-batch logic. Outer loop: `for repo in targetRepos: dispatch implementer(s)`.

## Branch-name collision handling

In workspace mode, `/orc:start` (and `/orc:flow` Phase 4) check the chosen branch against every target repo:

```bash
for r in $repos; do
  git -C "$r" show-ref --verify --quiet "refs/heads/$branch"
done
```

| Repo state | Action |
|------------|--------|
| Branch absent locally and on origin | OK — create. |
| Branch absent locally, present on origin | OK — `git fetch && git worktree add -B`. |
| Branch present, points at base HEAD | OK — adopt. |
| Branch present, has divergent commits | **Conflict — escalate via `AskUserQuestion`.** |

On conflict, print the Gate headline first (`**⛔ Gate — branch collision**`, one line naming the conflicting repos, per `orc:callouts`).

Recovery options on conflict (one prompt covering all conflicting repos at once):

1. **Suffix all repos** — append `-2` to the branch name everywhere so the workspace stays aligned (`feat/sso-login-2` in all repos). The suffix is recorded in the registry.
2. **Suffix only conflicting repos** — keep `feat/sso-login` in clean repos; `feat/sso-login-api` in the dirty one. `perRepoState[<repo>].branch` records the override; `branch` field tracks the canonical name.
3. **Adopt the existing branch** — assume prior work is the intended starting point. Surface the divergent commits in the plan-confirmation gate so the user explicitly opts in.
4. **Pick a different canonical name** — restart the branch-name input.
5. **Abort** — stop the flow; nothing written.

**Iron rule: workspace mode never silently picks.**
