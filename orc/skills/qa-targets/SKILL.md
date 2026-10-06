---
name: qa-targets
description: Resolve WHERE browser QA runs — named targets in .orc/targets.json (local, staging, preview), the Target gate, credential references (literal | op:// | env:), guard rule. Use before env provisioning in /orc:qa, /orc:flow Phase 6, /orc:evidence.
---

# QA targets

Browser QA runs against a **target**: `local` (the Docker env `orc-env-provisioner` boots) or a remote URL such as staging or a preview deploy. Targets live in `<repo>/.orc/targets.json` (gitignored, repo-level — not per branch), managed by `orc-targets` (plugin `bin/`, on PATH while orc is enabled).

**Announce at start:** "I'm using the qa-targets skill to resolve where browser QA runs."

## Registry shape

```json
{ "schema": 1, "targets": {
  "local":   { "kind": "local",  "baseUrl": null, "healthPath": "/", "guard": false, "users": {}, "login": null },
  "staging": { "kind": "remote", "baseUrl": "https://staging.example.com", "healthPath": "/healthz", "guard": true,
               "users": { "admin": { "username": "env:STAGING_ADMIN_USER", "password": "op://Eng/staging-admin/password" } },
               "login": { "path": "/login", "usernameField": "Email", "passwordField": "Password", "submit": "Sign in", "successPath": "/dashboard" } } } }
```

- `kind` — `local` is provisioned by `orc:browser-qa` Step 0 (today's path, unchanged); `remote` is probed, never provisioned.
- `guard: true` — a shared environment. The planner is told to tag mutating scenarios `@mutating`; on a guarded target those run as `skipped` with note `guarded target` — never silently dropped, never executed.
- `users.<name>.{username,password}` — **references, not values**: a literal, `op://vault/item/field` (1Password CLI, `op read`), or `env:VAR`. `orc-targets resolve <name>` substitutes them at run time and prints JSON for `ORC_TARGET_JSON`; the resolved JSON is **never written to disk**. Unresolvable ⇒ exit 3 ⇒ an escalation, not a skip.
- `login` — the recipe `tests/auth.setup.ts` follows once per run in the video-off `setup` project; the session is saved as `storageState` and reused by every scenario. Field hints match by label or placeholder text.

## Resolution order (every caller, same order)

1. `--target <name>` flag → use it silently (`orc-state decision set target <name> --provenance flag`).
2. `--web <url>` flag (kept for compatibility) → an ad-hoc remote target: `orc-targets resolve local --base-url <url>`; recorded as `target=adhoc:<url>`.
3. A settled `target` decision in the session → reuse silently; re-runs keep it.
4. Otherwise the **Target gate** below. `guided`/`full` autopilot: `local` (policy decision, printed one-liner) — a remote target is a judgment call and is never auto-picked.

## The Target gate (soft-inward, header chip `Target`)

Run `orc-targets init && orc-targets list`, then:

```markdown
> **⛔ Gate — QA target**
>
> Where should browser QA run? `local` boots the Docker env; remote targets are probed first and never provisioned.
```

`AskUserQuestion` (header `Target`), options in this order — `local` first, each remote row as `<name> — <baseUrl>` with `(read-only)` appended when `guard` is true, and last **New remote URL** (follow-up free text: URL, optional name to save, guard yes/no, optional user as `env:`/`op://` references — then `orc-targets set|user|login` and `resolve`). Record the answer: `orc-state decision set target <name> --provenance asked`.

## After the gate

- `kind: local` → continue to `orc:browser-qa` Step 0 (env attach/provision). `appUrl` from `docker-env-state.json` becomes `baseUrl` for the run (`orc-targets resolve local --base-url <appUrl>`).
- `kind: remote` → `orc-targets probe <name>`; failure is an **environment escalation** (`🛑 Escalation — target unreachable`: name, URL, curl exit) — stop, never fall back to local silently.
- Export for the engine: `ORC_TARGET_JSON="$(orc-targets resolve <name> [--base-url …])"`. Pass the **name** and `guard` to the validator/planner prompts; pass the JSON only through the environment of the `npx playwright test` call.

## Redaction rules (iron)

- Resolved credentials appear in no packet file: not `steps.md`, not `qa-manifest.json`, not the PR comment, not the explainer script. Reference the user by its registry name (`as admin`).
- The `setup` project records no video and no trace (config template, Slice 2) so the password is never typed on camera; scenario traces contain the session cookie only — acceptable for test environments, noted in `steps.md` as `Auth: storageState from setup project (user: admin)`.
- `op://` reads go through `op read` only; orc never caches the value.
