# npm / pnpm / yarn

## Audit

```bash
# Preferred when installed — reads the lockfile directly
osv-scanner scan --lockfile package-lock.json     # also: pnpm-lock.yaml, yarn.lock

# Native fallback
npm audit                          # human-readable, severity-grouped
npm audit --json                   # machine-parseable (rank findings yourself)
npm audit --omit=dev               # production-only view
pnpm audit                         # pnpm-native
yarn npm audit                     # yarn berry; classic: yarn audit
```

**Never run `npm audit fix --force`.** It applies major bumps silently (installs `semver`-incompatible versions) — the exact thing the doctrine forbids. Plain `npm audit fix` is acceptable only as a *preview* of what would change (`--dry-run`); apply the actual bumps one at a time.

## Outdated

```bash
npm outdated                       # current / wanted / latest table
npm outdated --json
pnpm outdated
yarn upgrade-interactive --latest  # yarn's interactive view (survey only — don't batch-apply)
```

`wanted` = highest version satisfying the manifest range (lockfile-only bump). `latest` = the dist-tag, may be a major.

## Upgrade

```bash
# Lockfile-only bump (preferred): moves within the existing manifest range
npm update <pkg>                   # respects semver range; touches package-lock.json only
pnpm update <pkg>
yarn up <pkg>                      # berry

# Range-moving bump (manifest + lockfile) — for minors outside the range
npm install <pkg>@<version> --save-exact   # pin precisely when the project pins
pnpm add <pkg>@<version>

# Verify what actually changed
git diff package.json package-lock.json
npm ls <pkg>                       # confirm the resolved tree
```

One package per commit. Run the full suite between bumps.

## Gotchas

- **Lockfile v3**: npm ≥9 writes `lockfileVersion: 3`. Older npm rewrites it back to v2 — a giant noise diff that buries the real bump. Confirm the team's npm major before committing; if the lockfile version flips in your diff, your npm doesn't match the repo's.
- **`overrides`** (`package.json`): force a transitive dependency's version when the direct dependent hasn't released a fix. Legitimate for *no-fix-yet* vulns, but it is a footgun — the override silently persists after upstream fixes and can pin you to an incompatible version. Always add a comment/tracking issue and re-check on the next audit. pnpm equivalent: `pnpm.overrides`; yarn: `resolutions`.
- **Peer-dependency conflicts** on bump: npm ≥7 fails hard. Do NOT reach for `--legacy-peer-deps` to force it through — that is a red suite in disguise. Treat it as a blocked bump and escalate.
- **Workspaces/monorepos**: `npm update <pkg> --workspaces` bumps everywhere; still one *package* per commit even if it lands in several workspace manifests. In Turborepo/pnpm monorepos, run the suite from the root so affected packages all execute.
- **`npm audit` noise**: it flags dev-only and unreachable transitive paths at full severity. Cross-check with `--omit=dev` before ranking; osv-scanner is generally less noisy.
