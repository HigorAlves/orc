---
name: sentry-cli-agent-guidance
version: 0.30.0
description: Best practices and operational guidance for AI coding agents using the Sentry CLI
requires:
  bins: ["sentry"]
  auth: true
---

# Agent Guidance

Best practices and operational guidance for AI coding agents using the Sentry CLI.

## Key Principles

- **Just run the command** — the CLI handles authentication and org/project detection automatically. Don't pre-authenticate or look up org/project before running commands. If auth is needed, the CLI prompts interactively.
- **Prefer CLI commands over raw API calls** — the CLI has dedicated commands for most tasks. Reach for `sentry issue view`, `sentry issue list`, `sentry trace view`, etc. before constructing API calls manually or fetching external documentation.
- **Use `sentry schema` to explore the API** — if you need to discover API endpoints, run `sentry schema` to browse interactively or `sentry schema <resource>` to search. This is faster than fetching OpenAPI specs externally.
- **Use `sentry issue view <id>` to investigate issues** — when asked about a specific issue (e.g., `CLI-G5`, `PROJECT-123`), use `sentry issue view` directly.
- **Use `--json` for machine-readable output** — pipe through `jq` for filtering. Human-readable output includes formatting that is hard to parse.
- **The CLI auto-detects org/project** — most commands work without explicit targets by checking `.sentryclirc` config files, scanning for DSNs in `.env` files and source code, and matching directory names. Only specify `<org>/<project>` when the CLI reports it can't detect the target or detects the wrong one.

## Design Principles

The `sentry` CLI follows conventions from well-known tools — if you're familiar with them, that knowledge transfers directly:

- **`gh` (GitHub CLI) conventions**: The `sentry` CLI uses the same `<noun> <verb>` command pattern (e.g., `sentry issue list`, `sentry org view`). Flags follow `gh` conventions: `--json` for machine-readable output, `--fields` to select specific fields, `-w`/`--web` to open in browser, `-q`/`--query` for filtering, `-n`/`--limit` for result count.
- **`sentry api` mimics `curl`**: The `sentry api` command provides direct API access with a `curl`-like interface — `--method` for HTTP method, `--data` for request body, `--header` for custom headers. It handles authentication automatically. If you know how to call a REST API with `curl`, the same patterns apply.

## Context Window Tips

- Use `--json --fields` to select specific fields and reduce output size. Run `<command> --help` to see available fields. Example: `sentry issue list --json --fields shortId,title,priority,level,status`
- Use `--json` when piping output between commands or processing programmatically
- Use `--limit` to cap the number of results (default is usually 10–100)
- Prefer `sentry issue view PROJECT-123` over listing and filtering manually
- Use `sentry api` for endpoints not covered by dedicated commands

## Safety Rules

- Always confirm with the user before running destructive commands: `project delete`, `trial start`
- For mutations, verify the org/project context looks correct in the command output before proceeding with further changes
- Never store or log authentication tokens — the CLI manages credentials automatically
- If the CLI reports the wrong org/project, override with explicit `<org>/<project>` arguments

## Exit Codes

The CLI uses semantic exit codes. Key ranges for agents:

| Range | Meaning | Agent Action |
|-------|---------|-------------|
| 0 | Success | Proceed normally |
| 10–19 | Auth error | Prompt user to run `sentry auth login` |
| 20–29 | Input error | Check command arguments and retry |
| 30–39 | API error | Retry or report to user |
| 40–49 | Feature unavailable | Inform user about plan/settings |
| 50–59 | Operation error | Report to user |
| 60–69 | Command-specific | Check stderr for details |

See [Exit Codes](/exit-codes/) for the complete reference.

## Workflow Patterns

### Investigate an Issue

```bash
# 1. Find the issue (auto-detects org/project from DSN or config)
sentry issue list --query "is:unresolved" --limit 5

# 2. Get details
sentry issue view PROJECT-123

# 3. Get AI root cause analysis
sentry issue explain PROJECT-123

# 4. Get a fix plan
sentry issue plan PROJECT-123
```

### Explore Traces and Performance

```bash
# 1. List recent traces (auto-detects org/project)
sentry trace list --limit 5

# 2. View a specific trace with span tree
sentry trace view abc123def456...

# 3. View spans for a trace
sentry span list abc123def456...

# 4. View logs associated with a trace
sentry trace logs abc123def456...
```

### Stream Logs

```bash
# Stream logs in real-time (auto-detects org/project)
sentry log list --follow

# Filter logs by severity
sentry log list --query "severity:error"
```

### Explore the API Schema

```bash
# Browse all API resource categories
sentry schema

# Search for endpoints related to a resource
sentry schema issues

# Get details about a specific endpoint
sentry schema "GET /api/0/organizations/{organization_id_or_slug}/issues/"
```

### Manage Releases

```bash
# Create a release — version must match Sentry.init({ release }) exactly
sentry release create my-org/1.0.0 --project my-project

# Associate commits via repository integration (needs local git checkout)
sentry release set-commits my-org/1.0.0 --auto

# Or read commits from local git history (no integration needed)
sentry release set-commits my-org/1.0.0 --local

# Mark the release as finalized
sentry release finalize my-org/1.0.0

# Record a production deploy
sentry release deploy my-org/1.0.0 production
```

**Key details:**
- The positional is `<org-slug>/<version>`. In `sentry release create sentry/1.0.0`, `sentry` is the org and `1.0.0` is the version — the slash separates org from version, it is not part of the version string.
- The **version** must match the `release` value in `Sentry.init()`. If your SDK uses `"1.0.0"`, the command must use `org/1.0.0`.
- `--auto` requires a Sentry repository integration (GitHub/GitLab/Bitbucket) **and** a local git checkout. It matches your `origin` remote against Sentry's repo list. Without a checkout, use `--local`.
- With no flag, `set-commits` tries `--auto` first and falls back to `--local` on failure.

### Arbitrary API Access

```bash
# GET request (default)
sentry api /api/0/organizations/my-org/

# POST request with data
sentry api /api/0/organizations/my-org/projects/ --method POST --data '{"name":"new-project","platform":"python"}'
```

## Quick Reference

### Time filtering

Use `--period` (alias: `-t`) to filter by time window:

```bash
sentry trace list --period 1h
sentry span list --period 24h
sentry span list -t 7d
```

### Scoping to an org or project

Org and project are positional arguments following `gh` CLI conventions:

```bash
sentry trace list my-org/my-project
sentry issue list my-org/my-project
sentry span list my-org/my-project/abc123def456...
```

### Listing spans in a trace

Pass the trace ID as a positional argument to `span list`:

```bash
sentry span list abc123def456...
sentry span list my-org/my-project/abc123def456...
```

### Dataset names for the Events API

When querying the Events API (directly or via `sentry api`), valid dataset values are: `spans`, `transactions`, `logs`, `errors`, `discover`.

## Common Mistakes

- **Wrong issue ID format**: Use `PROJECT-123` (short ID), not the numeric ID `123456789`. The short ID includes the project prefix.
- **Pre-authenticating unnecessarily**: Don't run `sentry auth login` before every command. The CLI detects missing/expired auth and prompts automatically. Only run `sentry auth login` if you need to switch accounts.
- **Missing `--json` for piping**: Human-readable output includes formatting. Use `--json` when parsing output programmatically.
- **Specifying org/project when not needed**: Auto-detection resolves org/project from `.sentryclirc` config files, DSNs, env vars, and directory names. Let it work first — only add `<org>/<project>` if the CLI says it can't detect the target or detects the wrong one.
- **Confusing `--query` syntax**: The `--query` flag uses Sentry search syntax (e.g., `is:unresolved`, `assigned:me`), not free text search.
- **Not using `--web`**: View commands support `-w`/`--web` to open the resource in the browser — useful for sharing links.
- **Fetching API schemas instead of using the CLI**: Prefer `sentry schema` to browse the API and `sentry api` to make requests — the CLI handles authentication and endpoint resolution, so there's rarely a need to download OpenAPI specs separately.
- **Release version mismatch**: The `org/version` positional is `<org-slug>/<version>`, where `org/` is the org, not part of the version. `sentry release create sentry/1.0.0` creates version `1.0.0` in org `sentry`. If your `Sentry.init()` uses `release: "1.0.0"`, this is correct. Don't double-prefix like `sentry/myapp/1.0.0`.
- **Running `set-commits --auto` without a git checkout**: `--auto` needs a local git repo to discover the origin remote URL and HEAD commit. In CI, ensure `actions/checkout` with `fetch-depth: 0` runs before `set-commits --auto`.
- **Using `sentry api` when CLI commands suffice**: `sentry issue list --json` already includes `shortId`, `title`, `priority`, `level`, `status`, `permalink`, and other fields at the top level. Some fields like `count`, `userCount`, `firstSeen`, and `lastSeen` may be null depending on the issue. Use `--fields` to select specific fields and `--help` to see all available fields. Only fall back to `sentry api` for data the CLI doesn't expose.
