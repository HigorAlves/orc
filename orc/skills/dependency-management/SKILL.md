---
name: dependency-management
description: Audit, survey, and upgrade project dependencies safely — severity-ranked vulnerability reports, one-bump-per-commit upgrade loop, majors escalated never auto-applied. Use when auditing dependencies for vulnerabilities, checking outdated packages, bumping a dependency, or when /orc:deps is invoked.
---

# Dependency Management

Doctrine for the three dependency verbs — **audit** (what's vulnerable), **outdated** (what's behind), **upgrade** (move safely). Ecosystem-specific commands and gotchas live in references:

| Ecosystem   | Reference                 |
| ----------- | ------------------------- |
| npm / pnpm / yarn | <references/npm.md>       |
| Python (pip / uv) | <references/python.md>    |
| Go / Rust         | <references/go-rust.md>   |

Read the relevant reference before running any audit or upgrade command.

## Audit

**Prefer `osv-scanner` when installed** (`command -v osv-scanner`) — it is ecosystem-agnostic, reads lockfiles directly, and covers polyglot repos in one pass:

```bash
osv-scanner scan --lockfile <lockfile>   # or: osv-scanner scan -r .
```

Otherwise fall back to the native tool per ecosystem: `npm audit` / `pip-audit` / `cargo audit` / `govulncheck` (exact invocations + gotchas in references).

### Severity-ranked reporting

Report findings ranked **critical → high → moderate → low**, never alphabetically or by package. For each: package, installed version, fixed version (if any), CVE/GHSA id, and whether the fix is a patch, minor, or major bump. Critical findings get the 🛑 danger callout. Distinguish:

- **Fixable** — a fixed version exists within the current major → candidate for the upgrade loop.
- **Fixable via major** — fix exists but requires a major bump → escalate (see below), never auto-apply.
- **No fix yet** — report it; suggest mitigations (overrides/constraints per references) only with user sign-off.
- **Dev-only vs production** — call out the dependency class; production trumps dev at equal severity.

## Outdated

Survey with the ecosystem's outdated command. Report as a table: package, current, wanted (in-range), latest, and the bump class (patch/minor/major). Recommend a batch of safe bumps (patch + minor) — but the batch is still **applied one bump at a time** via the upgrade loop.

## The upgrade loop

The iron discipline for applying any bump:

1. **ONE bump per commit.** Never batch multiple packages into a single commit — a broken suite must implicate exactly one bump.
2. **Lockfile-only changes preferred.** Bump within the existing manifest range when possible so the diff is just the lockfile; touch the manifest only when the range itself must move.
3. **Full suite green between bumps.** After each bump, run the project's existing test suite. Green → commit and move to the next. Red → **revert the bump entirely** (lockfile and manifest), record why, and continue with the rest. A bump that breaks the suite is never forced, patched around, or committed red.
4. **No new tests required.** Bumps run the *existing* suite — the bump commit contains the dependency change only.
5. **Majors are NEVER auto-applied.** A major bump is a migration, not a bump. Escalate each one individually to the user with: the package, current → target, and a link to the changelog or migration guide. Only proceed on explicit user approval, and even then as its own isolated commit (or its own branch if the migration touches code).

Commit message shape (per `orc:git-commit` conventions): `chore(deps): bump <pkg> from <old> to <new>` — one per bump, no AI attribution.

## Verification

Per `orc:verification-before-completion`: no "audit clean" or "upgrade complete" claim without the command output proving it — re-run the audit after upgrades and show the delta.
