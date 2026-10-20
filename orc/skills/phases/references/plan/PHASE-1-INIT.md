<!-- orc:plan/P1 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 1 — Initialize workspace

## Branch and state directory

1. In repo mode, run `git branch --show-current` for the current branch.
2. In workspace mode, ask the user for the branch name.
3. When called from `/orc:flow`, take the branch from the parent flow's checkpoint instead.
4. Sanitize the branch: `feat/142-foo` becomes `feat-142-foo`.
5. Create `${ORC_STATE_DIR}/<sanitized-branch>/files/` if it does not exist.
6. In workspace mode, also create the per-repo state dir below with a `workspace-link.json` back-pointer.

Per-repo state dir: `<workspaceRoot>/<repo>/.orc/<sanitized-branch>/`, one per target repo. Workspace mode has no cwd repo to read the branch from.

## Jira link

7. If the run has `--jira <KEY>`, validate it against `^[A-Z][A-Z0-9_]*-\d+$`.
8. On mismatch, reject and stop.
9. Else if `orc-state decision get jiraTicket` returns a settled key, use it silently and echo the settled-decision line.
10. Else if the tracker layer declares no Jira (`orc:tracker-config`), record `jiraTicket=none` inferred, silently.
11. Otherwise ask with `AskUserQuestion`: "Link a Jira ticket to this session?" with the options below.
12. On "Paste a key", prompt for the key and validate it the same way.
13. When a key resolves, set `JIRA_TICKET=<KEY>`; otherwise leave `JIRA_TICKET=null`.

`AskUserQuestion` options:

- `Paste a key`
- `Skip — I'll bind later via /orc:jira bind`
- `No ticket — this work has no tracker entry`

## Register state

14. Run `orc-state init --command plan --total-phases 4 [--jira <KEY>]`.
15. Write `checkpoint.md` with frontmatter `jiraTicket: <KEY>` when set, and `repos: [<list>]` in workspace mode.

Total phases: 4; 5 with `--issues`; 6 with `--grill --issues`. Workspace mode adds `--scope workspace --repos <targetRepos>`.

NOTE: a parent flow or start has often resolved the key already; that is the settled decision in step 9. Schema and rules per `orc:state-protocol`.
