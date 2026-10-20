# Workspace mode — one compose project per workspace branch

Disclosed from `orc:env-provisioning`. Read only when context is `workspace`: the `include:` wrapper, the per-repo fallback, dependency order, and what QA dispatch receives.

## Workspace mode

One compose project per workspace branch (`orc-<ws>-<branch>`), all services on one network. Primary: generate `compose.workspace.yaml` that `include:`s each repo's own compose (compose ≥ 2.20; per-file `project_directory` → that repo's worktree) plus generated blocks for repos without one — backends get containerized when possible so siblings actually run. Fallback (old compose / service-name collisions): per-repo projects joined by a shared external network. Dependency order db → api → ui via `depends_on: {condition: service_healthy}`, derived from the plan's cross-repo contract or env-var references (ui env has `API_URL` → ui depends on api). QA dispatch passes `appUrl` + `serviceEndpoints` + `envStatePath` — the validator NEVER boots when state says ready.
