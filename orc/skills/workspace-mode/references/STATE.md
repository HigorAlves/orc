# Workspace state layout, registry schema, and single-repo compatibility

Disclosed from `orc:workspace-mode`. Read when writing or reading workspace-level `.orc/` state, or when a command must decide whether cwd's state belongs to a workspace session.

## State layout

Workspace = `~/work/myapp/`, branch = `feat/sso-login` → sanitized `feat-sso-login`:

```
~/work/myapp/
├── .orc/                                          # workspace-level (shared)
│   ├── orc.json                                   # workspace registry
│   ├── feat-sso-login/files/
│   │   ├── plan.md                                # SHARED plan, slices tagged repo:
│   │   ├── checkpoint.md                          # flow-level phase tracking
│   │   ├── progress.md                            # rollup of per-repo logs
│   │   ├── docker-env-state.json                  # workspace Docker env (orc:env-provisioning)
│   │   ├── docker/                                # generated compose files (never committed)
│   │   ├── env/                                   # env evidence: ps.json, readiness.txt, boot.log
│   │   └── qa/                                    # cross-repo QA evidence
│   └── .worktrees/
│       ├── api/feat-sso-login/                    # workspace-default tree location
│       └── ui/feat-sso-login/
├── api/.orc/feat-sso-login/files/
│   ├── checkpoint.md                              # this repo's slice cursor
│   ├── progress.md                                # orc-implementer's per-repo log
│   ├── workspace-link.json                        # back-pointer (see below)
│   └── qa/                                        # repo-local QA only
└── ui/.orc/feat-sso-login/files/...
```

Rules:
- `plan.md` is authored once at workspace level. Each slice carries a `repo:` annotation declaring ownership.
- Worktrees default to `<workspace>/.orc/.worktrees/<repo>/<branch>/` — outside the repo, so `.gitignore` collisions are avoided by construction.
- Cross-repo QA (e.g. ui+api integration walks) lives at workspace level. Repo-local QA stays per-repo.

## Registry schema (workspace)

`<workspace>/.orc/orc.json` (`schemaVersion: 2`):

```json
{
  "schemaVersion": 2,
  "context": "workspace",
  "workspaceName": "myapp",
  "workspaceRoot": "/Users/x/work/myapp",
  "repos": [
    { "name": "api", "path": "/Users/x/work/myapp/api", "remote": "git@github.com:acme/api.git" },
    { "name": "ui",  "path": "/Users/x/work/myapp/ui",  "remote": "git@github.com:acme/ui.git" }
  ],
  "sessions": [
    {
      "session_id": "01HYZ...",
      "command": "flow",
      "scope": "workspace",
      "branch": "feat/sso-login",
      "branchSanitized": "feat-sso-login",
      "repos": ["api", "ui"],
      "planPath": ".orc/feat-sso-login/files/plan.md",
      "perRepoState": {
        "api": { "repoPath": "api", "worktree": ".orc/.worktrees/api/feat-sso-login", "currentSlice": 2, "prUrl": null },
        "ui":  { "repoPath": "ui",  "worktree": ".orc/.worktrees/ui/feat-sso-login",  "currentSlice": 1, "prUrl": null }
      },
      "linkedPRs": [],
      "current_phase": 5,
      "total_phases": 9,
      "status": "in_progress",
      "created_at": "2026-05-04T14:10:00Z",
      "updated_at": "2026-05-04T15:02:11Z"
    }
  ]
}
```

Per-repo `<repo>/.orc/orc.json` keeps the existing single-repo schema. New entries set `"scope": "repo"` (existing behavior) or `"scope": "workspace-member"` (back-pointer record only). `/orc:status` and `/orc:resume` discriminate by reading `scope`.

## Backward compatibility (workspace ↔ single-repo)

The risk: a workspace flow writes `<workspace>/.orc/feat-sso-login/files/plan.md`. Later the user `cd`s into one repo and runs `/orc:status` — old code would only look at `<repo>/.orc/orc.json` and miss the workspace state.

Defenses:

1. **`workspace-link.json` stub** in every per-repo `<repo>/.orc/<branch>/` written by a workspace flow:
   ```json
   { "scope": "workspace-member", "workspaceRoot": "../..", "workspaceName": "myapp", "sessionId": "01HYZ...", "branch": "feat/sso-login" }
   ```
   `/orc:status` and `/orc:resume` test for this file and walk to the workspace registry when present.
2. **Disjoint artifact sets** — workspace-member dirs never contain `plan.md`; single-repo dirs always do. Presence of `plan.md` is the second-line collision detector.
3. **Detection precedence** — if cwd is inside a repo, the helper returns `repo` even when that repo lives under a workspace. Routing-up happens via the link file.
4. **`scope` discriminator** on every registry entry. Legacy entries with no `scope` are read as `repo` by default.
5. **Refuse-and-prompt on real collision** — workspace flow refuses to overwrite a per-repo `.orc/<branch>/` whose `plan.md` exists and is not workspace-member; user picks rename or `/orc:cleanup` evict.
6. **Schema bump** — `schemaVersion: 2` (workspace-aware). Reads handle both; writes upgrade in place.
