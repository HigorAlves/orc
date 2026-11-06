# Go / Rust

## Go

### Audit

```bash
# Preferred when installed
osv-scanner scan --lockfile go.mod

# Native: govulncheck (golang.org/x/vuln) — the only tool here that does reachability analysis
govulncheck ./...                  # symbol-level: reports only vulns your code actually calls
govulncheck -mode=binary <bin>     # audit a built binary
govulncheck -json ./...
```

govulncheck's reachability analysis is the reason to prefer it over raw osv-scanner output for ranking: a vuln in an *imported but uncalled* function is real but lower urgency — report both counts (called vs merely imported).

### Outdated

```bash
go list -m -u all                  # every module: current [available]
go list -m -u -json all            # machine-parseable
```

### Upgrade

```bash
go get <module>@<version>          # ONE module, exact version — never bare `go get -u ./...` (batch, includes majors of transitive deps)
go mod tidy                        # always after a bump; run in the same commit
go build ./... && go test ./...    # full suite between bumps
```

### Gotchas

- **Majors are new import paths** (`/v2`, `/v3`): `go get` cannot "bump" you across a major — it's a code change to every import line. Automatic escalation: hand the user the module's release notes and treat it as a migration.
- **`go.sum` churn**: a one-module bump legitimately touches many `go.sum` lines (new hashes for the module + updated transitives). That's still a one-bump commit; don't mistake sum churn for a batch bump.
- **Toolchain/`go` directive**: some bumps raise the `go` version in `go.mod`. That changes the build toolchain for everyone — surface it explicitly, don't let it ride along silently.
- **MVS**: Go picks the *minimum* version satisfying all requirements, so `go list -m -u` "available" versions may not resolve after other constraints — verify with `go mod graph | grep <module>` when a bump doesn't take.

## Rust

### Audit

```bash
# Preferred when installed
osv-scanner scan --lockfile Cargo.lock

# Native: cargo-audit (RustSec advisory DB)
cargo audit                        # reads Cargo.lock
cargo audit --json
cargo audit fix --dry-run          # preview only — apply bumps yourself, one at a time
```

cargo-audit also flags **unmaintained** and **yanked** crates — report those in a separate section below the vulnerability ranking (they're smells, not CVEs).

### Outdated

```bash
cargo outdated                     # needs cargo-outdated installed; project/workspace table
cargo outdated -R                  # root dependencies only — the actionable view
```

### Upgrade

```bash
# cargo update precision — the lockfile-only tools
cargo update -p <crate>                        # bump ONE crate within the Cargo.toml semver range
cargo update -p <crate> --precise <version>    # to an exact version (incl. holding BACK a bad release)
cargo update --dry-run                         # preview any of the above

# Range-moving bump (Cargo.toml + Cargo.lock)
cargo add <crate>@<version>

cargo test --all-features          # full suite between bumps; add --workspace in workspaces
```

Never bare `cargo update` in the loop — it re-resolves the entire lockfile (batch bump).

### Gotchas

- **`-p` spec ambiguity**: with multiple versions of a crate in the tree, disambiguate as `cargo update -p <crate>@<current-version>` or cargo errors out.
- **`--precise` across incompatible versions** fails by design — a version outside the Cargo.toml range needs the manifest edited (that's a range-moving bump, or a major → escalate).
- **Workspace-level bumps**: `cargo update -p` acts on the whole workspace lockfile — one crate can move in several members' trees at once. Still one crate = one commit.
- **MSRV**: a bump can raise a crate's minimum supported Rust version and break CI on older toolchains even though tests pass locally. Check the `rust-version` field in the new release when CI pins a toolchain.
