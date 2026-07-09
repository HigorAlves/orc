---
name: env-provisioning
description: "Provision a fast, reproducible dev environment for QA or standalone use — detection ladder (compose > devcontainer > Dockerfile > generated), healthcheck-gated boot, docker-env-state.json contract, reuse/teardown rules, host-mode fallback. Protocol for /orc:env, /orc:qa Phase 4, /orc:flow Phase 6, and the orc-env-provisioner agent."
---

# Environment Provisioning

Stand up the app (and its backing services) so QA — or the user — can run against a real, reproducible environment. Honors the project's own setup guidelines when they exist; generates the minimum when they don't. Speed is a design goal: the second boot on a branch should take seconds, not minutes.

**Announce at start:** "I'm using the env-provisioning skill because this task needs the app running."

Deep Docker knowledge (multi-stage builds, hardening, compose patterns) lives in `orc:docker-expert` — reference it, never duplicate it. This skill owns the *protocol*: detect → provision → prove → record.

## Detection ladder

Evaluate top-down in the **worktree** (the code under test), first hit wins. Setup guidelines (README/CONTRIBUTING "Setup"/"Getting started" sections, `Makefile`, `.env.example`) are consulted at EVERY rung — they supply env values, seed/migrate steps, ports, and the service list; they never override a higher rung's boot mechanism. Details + inference tables: `references/detection.md`.

1. **Existing compose** — `compose.yaml|compose.yml|docker-compose.yml|docker-compose.yaml` (+ overrides, `dev` profiles). This IS the project's runnable setup guideline. Use as-is; NEVER edit it — meet extra port/env needs with an orc-owned override file in `.orc/<branch>/files/docker/`.
2. **Devcontainer** — `.devcontainer/devcontainer.json` (or root variant). If it names `dockerComposeFile` → resolve to rung 1 with that file. Else wrap its image/Dockerfile in a generated compose honoring `forwardPorts`, `containerEnv`, `postCreateCommand` (as a one-shot).
3. **Dockerfile** — `Dockerfile` / `Dockerfile.dev`. Generate a compose: app builds from it (prefer a `dev`/`development` stage when multi-stage), plus inferred backing services.
4. **Nothing** — generate from analysis (`references/generation.md`). Default is **hybrid**: containers for backing services only (inferred from `.env.example`/config — `DATABASE_URL`→postgres, `REDIS_URL`→redis, …), app on the host via its dev script wired to them. Fastest and least invented; macOS bind-mount I/O makes containerized node dev servers *slower*. `--containerize-app` forces a full app container.

All generated files land in `.orc/<branch>/files/docker/` — never in the repo. Committing a real compose file into the project happens only on explicit user request, via the normal plan → PR path.

## Provisioning protocol

0. **Attach first.** Run `orc-docker-env is-ready <state-file>`. `ready` → verify line, set `reused: true`, refresh `lastVerifiedAt`, STOP — this is the sub-10-second path; skipping it throws away the main speed lever. `--fresh` bypasses (down + re-provision).
1. **Probe Docker.** `orc-docker-env probe`. Anything but `ok` → host-mode fallback (below). Never hard-block QA on a missing daemon.
2. **Detect** via the ladder; record the rung in `detectionRung`.
3. **Reconcile guidelines.** Env values from `.env.example` → `env.orc` with dev-safe defaults (never invent secrets — placeholder + surface); seed/migrate commands run as one-shots AFTER healthy (destructive ones gate via `AskUserQuestion`); the app's port/URL.
4. **Generate** (rungs 2–4, workspace wrapper) into `.orc/<branch>/files/docker/`. Every generated service gets a healthcheck. Validate with `docker compose config` before boot; save the rendered output as evidence.
5. **Port pre-flight.** `lsof -i :<port>` per host port. Same-project occupancy → reuse. Foreign occupancy → gate: remap (generated files only, via override) / stop the other env / abort.
6. **Boot.** `docker compose -p <project> -f <files…> up -d --wait --wait-timeout 120`. `--build` only when `buildInputsHash` (Dockerfile + lockfile hash) changed or `--rebuild` passed.
7. **Probe readiness** beyond compose health: `curl -sf <appUrl>` (retry ≤ 30s) and each HTTP endpoint in `serviceEndpoints`. Log every probe.
8. **Capture evidence** to `.orc/<branch>/files/env/`: `compose.rendered.yaml`, `ps.json`, `readiness.txt`, `boot.log`, `env-report.md` (narrative: rung, found vs generated, boot seconds, reuse flag).
9. **Write state** — `docker-env-state.json` (schema below), append `docker_env_status: <status> (…)` to `checkpoint.md`, one line to `progress.md`.
10. **Report**: state path, appUrl + endpoints, boot seconds, reused flag, verdict `ready|fallback|failed`.

## State contract — `docker-env-state.json`

Lives at `.orc/<branch>/files/docker-env-state.json` (workspace-level when context=workspace; per-repo otherwise). `status` enum: `provisioning|ready|partial|failed|fallback|down`.

```json
{
  "schemaVersion": 1, "context": "repo", "status": "ready", "mode": "compose",
  "detectionRung": "existing-compose",
  "project": "orc-myapp-feat-csv-export",
  "composeFiles": ["/abs/path/docker-compose.yml"], "generatedFiles": [],
  "appUrl": "http://localhost:3000",
  "serviceEndpoints": { "app": "http://localhost:3000", "db": "postgres://localhost:5432/app_dev" },
  "services": { "app": {"container": "…-app-1", "port": 3000, "health": "healthy", "status": "running"},
                "db":  {"container": "…-db-1",  "port": 5432, "health": "healthy", "status": "running"} },
  "hostProcesses": [], "volumes": ["orc-myapp-feat-csv-export_db_data"],
  "buildInputsHash": "sha256:…", "reused": false, "bootDurationSec": 41,
  "bootstrappedAt": "…", "lastVerifiedAt": "…", "evidenceDir": ".orc/<branch>/files/env/",
  "teardownCommand": "docker compose -p orc-myapp-feat-csv-export -f /abs/path/docker-compose.yml down",
  "keepVolumesOnDown": true
}
```

Workspace context adds: `workspaceName`, `webSurfaceRepo`, `dependencyOrder` (e.g. `["db","api","ui"]`), `serviceOwners` (service → repo). Host-fallback differs only in `status: "fallback"`, `mode: "host"`, empty `services`, populated `hostProcesses[]` (`{command, pid, cwd, port, logFile}`), `teardownCommand: "kill <pid>"`.

## Speed levers

| MUST | Why |
|------|-----|
| Attach before boot (`orc-docker-env is-ready`) | The whole point — seconds, not minutes |
| `up -d --wait --wait-timeout <N=120>` | Healthcheck-gated readiness, no sleep-and-hope |
| Named volumes keyed by project (db data; `node_modules` in full mode) | Survive `down`; second boot near-instant |
| Stable project name (`orc-<name>-<branch>`) | Layer/volume/network reuse + orphan-sweep key |
| Hash-gated `--build` (`buildInputsHash`) | Rebuild only when Dockerfile/lockfile changed |
| Port pre-flight via `lsof` | Fail at gate, not mid-boot |

MAY: `docker compose watch` (only when the project's compose declares `develop.watch`), `--profile dev` selection, parallel `docker compose pull` pre-warm.

## Workspace mode

One compose project per workspace branch (`orc-<ws>-<branch>`), all services on one network. Primary: generate `compose.workspace.yaml` that `include:`s each repo's own compose (compose ≥ 2.20; per-file `project_directory` → that repo's worktree) plus generated blocks for repos without one — backends get containerized when possible so siblings actually run. Fallback (old compose / service-name collisions): per-repo projects joined by a shared external network. Dependency order db → api → ui via `depends_on: {condition: service_healthy}`, derived from the plan's cross-repo contract or env-var references (ui env has `API_URL` → ui depends on api). QA dispatch passes `appUrl` + `serviceEndpoints` + `envStatePath` — the validator NEVER boots when state says ready.

## Reuse & teardown

The environment **stays up between QA runs on a branch** — that is the speed win. Teardown owners: `/orc:cleanup` (adds `docker compose -p <project> down` to its destructive preview; volumes kept unless `--down-volumes`) and `/orc:flow` Phase 9. Standalone: `/orc:env down`. Orphans (`orc-*` compose projects with no registered session — `orc-docker-env orphans`) surface in previews, never auto-removed.

## Iron rule

**No "environment ready" claim without healthcheck evidence.** `status: ready` requires `env/ps.json` showing every service running/healthy AND a successful appUrl probe in `env/readiness.txt`. Anything less is `partial`/`failed`:

```markdown
> [!CAUTION]
> **🛑 Blocked — environment not ready**
>
> <service>: <state> after <N>s. Last log lines in env/boot.log. No QA against an unproven environment.
```

## Fallback — never hard-block QA

Probe ladder: docker installed → daemon up → compose v2 → containerizable (no Xcode-only / Electron-dev-loop / "requires macOS" signals). Any failure → **host-mode fallback**: the provisioner still owns the boot (dev script + curl poll), still writes the state file (`status: fallback`, `mode: host`, `hostProcesses[]`) and readiness evidence, and emits:

```markdown
> [!WARNING]
> **⚠️ Caution — Docker unavailable, host-mode fallback**
>
> <reason: not installed | daemon down (`open -a Docker`) | not containerizable: <why>>. Booting via `<dev command>` instead; backing services (if any) must already be reachable.
```

QA proceeds against the fallback appUrl. Because even fallback boots through the provisioner, the validator's rule stays uniform: attach when state exists, never boot.

## Pointers into `orc:docker-expert`

| Need | Reference |
|------|-----------|
| Compose orchestration patterns, service deps, dev overrides | `docker-expert/references/compose.md` |
| Healthchecks, non-root, secrets handling | `docker-expert/references/security-hardening.md` |
| Build caching for `--containerize-app` | `docker-expert/references/multistage-builds.md` |
| Runtime/Compose validation + diagnostics | `docker-expert/references/production-deploy.md` |
