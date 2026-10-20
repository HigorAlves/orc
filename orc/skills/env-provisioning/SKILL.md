---
name: env-provisioning
description: "Provision a fast, reproducible dev environment for QA or standalone use — healthcheck-gated boot, reuse/teardown rules, host-mode fallback. Protocol for /orc:env, /orc:qa Phase 4, /orc:flow Phase 6, and the orc-env-provisioner agent."
---

# Environment Provisioning

Stand up the app (and its backing services) so QA — or the user — can run against a real, reproducible environment. Honors the project's own setup guidelines when they exist; generates the minimum when they don't. Speed is a design goal: the second boot on a branch takes seconds, not minutes.

**Announce at start:** "I'm using the env-provisioning skill because this task needs the app running."

Deep Docker knowledge (multi-stage builds, hardening, compose patterns) lives in `orc:docker-best-practices` — reference it, never duplicate it. This skill owns the *protocol*: detect → provision → prove → record.

## Detection ladder

Evaluate top-down in the **worktree** (the code under test), first hit wins. Setup guidelines (README/CONTRIBUTING "Setup"/"Getting started" sections, `Makefile`, `.env.example`) are consulted at EVERY rung — they supply env values, seed/migrate steps, ports, and the service list; they never override a higher rung's boot mechanism. Rung specifics (override mechanics, devcontainer mapping, dev-stage preference, the hybrid rationale) + inference tables: `references/detection.md`.

1. **Existing compose** — `compose.yaml|compose.yml|docker-compose.yml|docker-compose.yaml` (+ overrides, `dev` profiles). Use as-is; NEVER edit it — extra needs go in an orc-owned override.
2. **Devcontainer** — `.devcontainer/devcontainer.json` (or root variant). `dockerComposeFile` → rung 1; else wrap its image/Dockerfile in a generated compose.
3. **Dockerfile** — `Dockerfile` / `Dockerfile.dev`. Generate a compose: app builds from it, plus inferred backing services.
4. **Nothing** — generate from analysis (`references/generation.md`). Default **hybrid**: backing services in containers, app on host; `--containerize-app` forces an app container.

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

Lives at `.orc/<branch>/files/docker-env-state.json` (workspace-level when context=workspace; per-repo otherwise). `status` enum: `provisioning|ready|partial|failed|fallback|down`. Read [STATE-SCHEMA.md](references/STATE-SCHEMA.md) when writing the file (step 9) or reading it: the full schema, workspace additions, and the host-fallback shape.

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

One compose project per workspace branch (`orc-<ws>-<branch>`), all services on one network. Read [WORKSPACE.md](references/WORKSPACE.md) only when context is `workspace`: the `include:` wrapper, the per-repo fallback, dependency order, and the QA dispatch inputs.

## Reuse & teardown

The environment **stays up between QA runs on a branch** — that is the speed win. Teardown owners: `/orc:cleanup` (adds `docker compose -p <project> down` to its destructive preview; volumes kept unless `--down-volumes`) and `/orc:flow` Phase 9. Standalone: `/orc:env down`. Orphans (`orc-*` compose projects with no registered session — `orc-docker-env orphans`) surface in previews, never auto-removed.

## Iron rule

**No "environment ready" claim without healthcheck evidence.** `status: ready` requires `env/ps.json` showing every service running/healthy AND a successful appUrl probe in `env/readiness.txt`. Anything less is `partial`/`failed`:

```markdown
> **🛑 Blocked — environment not ready**
>
> <service>: <state> after <N>s. Last log lines in env/boot.log. No QA against an unproven environment.
```

## Fallback — never hard-block QA

Any failure on the probe ladder (docker installed → daemon up → compose v2 → containerizable) means **host-mode fallback**: the provisioner still owns the boot, still writes the state file and readiness evidence, and QA proceeds against the fallback appUrl. Read [FALLBACK.md](references/FALLBACK.md) when step 1 returns anything but `ok`: the ladder, the Caution callout, and the pointers into `orc:docker-best-practices`.

