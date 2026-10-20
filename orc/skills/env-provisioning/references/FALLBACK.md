# Fallback — never hard-block QA

Disclosed from `orc:env-provisioning`. Read when the Docker probe (step 1) returns anything but `ok`: the probe ladder, the host-mode boot, and the Caution callout. Also holds the pointers into `orc:docker-best-practices`.

## Fallback — never hard-block QA

Probe ladder: docker installed → daemon up → compose v2 → containerizable (no Xcode-only / Electron-dev-loop / "requires macOS" signals). Any failure → **host-mode fallback**: the provisioner still owns the boot (dev script + curl poll), still writes the state file (`status: fallback`, `mode: host`, `hostProcesses[]`) and readiness evidence, and emits:

```markdown
> **⚠️ Caution — Docker unavailable, host-mode fallback**
>
> <reason: not installed | daemon down (`open -a Docker`) | not containerizable: <why>>. Booting via `<dev command>` instead; backing services (if any) must already be reachable.
```

QA proceeds against the fallback appUrl. Because even fallback boots through the provisioner, the validator's rule stays uniform: attach when state exists, never boot.

## Pointers into `orc:docker-best-practices`

| Need | Reference |
|------|-----------|
| Compose orchestration patterns, service deps, dev overrides | `docker-best-practices/references/compose.md` |
| Healthchecks, non-root, secrets handling | `docker-best-practices/references/security-hardening.md` |
| Build caching for `--containerize-app` | `docker-best-practices/references/multistage-builds.md` |
| Runtime/Compose validation + diagnostics | `docker-best-practices/references/production-deploy.md` |
