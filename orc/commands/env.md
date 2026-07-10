---
description: "Provision a fast containerized dev environment for the current repo or workspace — detects existing Docker setup (compose > devcontainer > Dockerfile) or generates one, boots with healthchecks, stays up for reuse across QA runs. Verbs: up (default) | status | down."
argument-hint: "[up|status|down] [--containerize-app] [--rebuild] [--fresh] [--down-volumes] [--wait-timeout <s>] [--repos a,b | --repo a | --all-repos | --this-repo]"
arguments: [verb]
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(orc-workspace-detect:*)
  - Bash(orc-docker-env:*)
  - Bash(docker compose:*)
  - Bash(jq:*)
---

# /orc:env

Give the current project (or workspace) a running dev environment — the same one `/orc:qa` and `/orc:flow` boot before browser QA. Standalone uses: "I want to poke at the app", pre-warming the env before a QA run, checking what's up, tearing down.

## When NOT to use

Production deploys, remote/cloud environments, Kubernetes — out of scope by design (see `orc:docker-expert`'s hand-off list). This command provisions **local dev** environments only.

## Arguments

- `up` (default) — provision or attach. Honors the full detection ladder from `orc:env-provisioning`.
- `status` — read-only: state file + live `docker compose ps` verification + orphan sweep.
- `down` — tear down the current branch's environment. Destructive; previews and confirms first.
- `--containerize-app` — force a full app container when nothing exists (default is hybrid: services in Docker, app on host).
- `--rebuild` — force `--build` on boot regardless of `buildInputsHash`.
- `--fresh` — ignore reusable state: `down` first, then re-provision from scratch.
- `--down-volumes` — with `down`: also remove named volumes (default keeps them so the next boot reuses DB data).
- `--wait-timeout <s>` — healthcheck wait budget (default 120).
- `--repos a,b` / `--repo a` / `--all-repos` / `--this-repo` — workspace-mode targeting. See `orc:workspace-mode`.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection). `loose` context → surface and stop (no state dir to write). In workspace mode, resolve target repos from flags or `AskUserQuestion` — iron rule: no silent broadcast.

### Phase 1 — Resolve the verb + state path

`$verb` is the first argument (`up` when empty). State file: `orc-docker-env state-path "$ORC_STATE_DIR" <sanitized-branch>` — in workspace mode the workspace-level state dir; single-repo mode the repo's.

### Phase 2 — `up`

1. Invoke the `orc:env-provisioning` skill (announce it). Quick attach check first: `orc-docker-env is-ready <state-file>` — `ready` → echo the reuse line (project, services, appUrl, "reused") and skip to step 3.
2. Dispatch **`orc-env-provisioner`** via `Task`. Pass: `repoPath` (worktree), `stateDir`, `branchSanitized`, the flags, and — workspace mode — `repos[]`/`repoPaths`, `webSurfaceRepo` (from the plan's "Repo touchpoints" when present), plan path for dependency order. On `failed` verdict: re-print the agent's 🛑 callout and `AskUserQuestion` — retry / `--fresh` retry / abort. On `fallback`: re-print the ⚠️ callout and continue.
3. **Register the session.** If `.orc/orc.json` has an in-progress session for this branch, append `docker_env_status: <status> (…)` to its checkpoint. Otherwise register a lightweight entry (`command: "env"`, `status: "in_progress"`, branch, `startedAt`) so `/orc:status` shows the running environment and `/orc:cleanup` can find it.
4. Echo: state path, appUrl + serviceEndpoints, boot seconds, reused flag.

### Phase 3 — `status` (read-only)

1. Read the state file; `orc-docker-env is-ready <state-file>` for live truth (state can lie after a reboot — `ps` doesn't).
2. Orphan sweep: collect known projects from every reachable state file (`jq -r .project`), then `orc-docker-env orphans <known...>`.
3. Render one table: project, mode, status (state) vs live, appUrl, services n/n running, boot age. Orphans listed below with:

```markdown
> **⚠️ Caution — orphaned orc environments**
>
> <N> compose project(s) named orc-* have no registered session: <list>. Tear down via `docker compose -p <name> down` or `/orc:cleanup`.
```

Never auto-remove anything here.

### Phase 4 — `down` (destructive)

1. `orc-docker-env teardown-preview <state-file>` and render the danger callout:

```markdown
> **🛑 Destructive preview**
>
> Tears down the environment below. Named volumes are KEPT unless --down-volumes was passed.
```

```
<teardown-preview output verbatim>
```

2. `AskUserQuestion`: Proceed / Cancel.
3. Execute `teardownCommand` (+ `-v` when `--down-volumes`); kill recorded `hostProcesses[]` PIDs (verify the PID still runs the recorded command first — never kill a reused PID blindly: surface instead).
4. Set state `status: down`, note it in checkpoint. Keep the state file (history for reuse of generated compose next `up`).

## Iron rules

- `status` is read-only — no state mutations, no container operations beyond `ps`/`ls`.
- `down` only ever targets this branch's recorded project (or a user-confirmed orphan via cleanup). Never `down` a project not matching the `orc-` prefix.
- No "environment ready" echo without the agent's evidence-backed `ready` verdict (or a live `is-ready` pass).

## Output

- `docker-env-state.json` + `.orc/<branch>/files/env/` evidence (via the agent)
- Session entry / checkpoint line
- Echoed state summary with appUrl
