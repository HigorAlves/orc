# Install

orc ships in **two layers**, and it helps to keep them straight:

- **The `orc` CLI** — a small local Go tool you install on *your machine*.
- **The `orc` plugin** — what actually adds the `/orc:*` commands *inside Claude Code*.

You install the CLI once; the CLI then installs and configures the plugin for you. **This guide walks you from zero to a working setup, one step at a time.** Prefer to skip the CLI? Jump to [the marketplace path](#prefer-the-plugin-marketplace-directly-no-cli).

> [!NOTE]
> **Prerequisites.** macOS or Linux (Intel/AMD or Apple Silicon/ARM), plus [Claude Code](https://claude.com/claude-code) with its `claude` CLI on your `PATH`. You do **not** need `git` or `jq` beforehand — step 2 installs them. (If the `claude` CLI isn't on `PATH`, step 3 still works: it writes `~/.claude/settings.json` directly.)

## 1. Install the orc CLI

```bash
curl -fsSL https://raw.githubusercontent.com/HigorAlves/orc/main/cli/install.sh | sh
```

This detects your OS and architecture, resolves the latest release, downloads it from GitHub Releases, and verifies it against `checksums.txt`. Confirm it landed:

```bash
orc version
```

**You should see** a semantic version (e.g. `0.10.0`) — **not** the word `dev`. That confirms you got a real release build.

> [!TIP]
> **Prefer Go?** `go install github.com/HigorAlves/orc/cli/cmd/orc@latest` (requires Go ≥ 1.25.8). A source build injects no version metadata, so `orc version` prints `dev` — that's expected. **Homebrew** is on the way: once the `HigorAlves/homebrew-tap` cask is published, `brew install --cask HigorAlves/tap/orc` will be the one-liner. See [Other ways to install](#other-ways-to-install-the-cli).

## 2. Install the runtime tools orc needs

```bash
orc doctor --fix
```

Checks the tools orc relies on and installs any that are missing via your system package manager. **You should see** `git` and `jq` reported present — these two are **required** (`orc doctor` exits non-zero if either is missing). It also offers the **recommended** set (`gh`, `agent-browser`, `acli`, `docker`, `graphify`, `osv-scanner`, `gitleaks`, `sentry-cli`, `ffmpeg`); those aren't required, but individual commands use them — see [Requirements](#requirements) for who uses what.

> [!TIP]
> Running unattended (CI, dotfiles)? Add `-y` to skip prompts: `orc doctor --fix -y`. Just want to check without installing? Run `orc doctor` on its own.

## 3. Register the marketplace and enable the plugin

```bash
orc install
```

Registers the `orc` marketplace and enables the `orc@orc` plugin. When the `claude` CLI is on your `PATH`, orc drives it; otherwise it writes the same entries into `~/.claude/settings.json` directly.

> [!TIP]
> Pin a specific version: `orc install --ref orc--v0.22.0` (any existing release tag, or a commit SHA). Using `--ref` writes `settings.json` directly.

## 4. Load the plugin in Claude Code

Plugin commands load at startup. **Restart Claude Code** — or, in an open session, run `/reload-plugins`.

## 5. Verify it worked

Inside Claude Code, run `/plugin`. **You should see** `orc@orc` listed and enabled. Now type `/orc:` at the prompt — **you should see** the command palette populate (`/orc:flow`, `/orc:plan`, `/orc:ship`, …). That's the whole setup live.

Optionally, initialize per-repo state (run **inside a git repo**, or a workspace directory holding 2+ repos):

```bash
orc init
```

**You should see** an `.orc/` directory created (with `orc.json` + `pr-budget.json`, and `.orc/` added to your gitignore). This is optional — commands that need it will offer to create it.

**Done.** From zero to a verified, working orc. Head to [commands.md](commands.md) to pick your first command, or the [examples](examples/README.md) for scenario walk-throughs.

---

## Other ways to install the CLI

Reference alternatives to step 1. After either, **continue from step 2** (`orc doctor --fix`).

**From source (`go install`)** — requires Go ≥ 1.25.8:

```bash
go install github.com/HigorAlves/orc/cli/cmd/orc@latest
```

**One-line bootstrap options.** The `curl | sh` installer honors two env overrides: `ORC_VERSION` (a release tag; default is latest) and `ORC_BIN_DIR` (install dir; defaults to `/usr/local/bin`, falling back to `~/.local/bin` when that's absent or unwritable). It needs `curl`, `tar`, and `shasum`/`sha256sum`.

**Homebrew (planned).** goreleaser is configured to publish a cask to `HigorAlves/homebrew-tap` on each release; once that tap repo exists, `brew install --cask HigorAlves/tap/orc` becomes available (the cask's macOS post-install hook strips the `com.apple.quarantine` attribute so the unsigned binary runs without a Gatekeeper prompt).

## Prefer the plugin marketplace directly (no CLI)

You don't have to install the CLI at all. orc is published as a single-plugin marketplace at this repo, so you can enable it entirely from **inside Claude Code**:

```
/plugin marketplace add HigorAlves/orc
/plugin install orc@orc
```

The first command registers `https://github.com/HigorAlves/orc` as a marketplace named `orc`; the second installs the plugin. Pull updates with `/plugin update orc@orc`.

To pin a specific tag or commit, use the longhand source form in `~/.claude/settings.json`:

```jsonc
{
  "extraKnownMarketplaces": {
    "orc": {
      "source": {
        "source": "url",
        "url": "https://github.com/HigorAlves/orc.git",
        "ref": "orc--v0.22.0"
      }
    }
  },
  "enabledPlugins": { "orc@orc": true }
}
```

> [!NOTE]
> **Trade-off vs. the CLI.** The marketplace path installs the *plugin only* — it does **not** check or install the runtime tools (`git`, `jq`, and the recommended set) that many commands depend on. Run `orc doctor` afterward, or install those tools yourself.
>
> The plugin uses an HTTPS clone URL so it works on machines without GitHub SSH keys. If you have `git config --global url."git@github.com:".insteadOf "https://github.com/"` set, that rewrite will also hit this URL — temporarily disable it if the install fails.

## Requirements

orc's SessionStart pre-flight (`session-start-tool-check.sh`) verifies these CLI tools and, if anything's missing, delivers an "orc tool check" callout to you via `systemMessage`.

| Tool | Tier | Used by |
|------|------|---------|
| `git` | required | every command |
| `jq` | required | hook scripts (parse Bash tool input) |
| `gh` | recommended | `/orc:code-review`, `/orc:address`, `/orc:ship`, `/orc:postmortem` |
| `agent-browser` | recommended | `/orc:qa` (web mode — browser-driven QA evidence) |
| `acli` | recommended | `/orc:jira`, Jira ticket linking, PRD/TRD `--from-jira` seeding |
| `docker` | recommended | `/orc:env`, `/orc:qa` / `/orc:flow` env provisioning (host-mode fallback applies without it) |
| `graphify` | recommended | `/orc:plan`, `/orc:start`, `/orc:flow`, `/orc:debug` — code discovery via a code graph instead of grep |
| `osv-scanner` | recommended | `/orc:deps` — ecosystem-agnostic vulnerability audit (per-ecosystem scanners as fallback) |
| `gitleaks` | recommended | `/orc:code-review --audit` — secret scanning (regex fallback without it) |
| `sentry-cli` | recommended | `/orc:incident` — pull Sentry issues/events into live triage |
| `ffmpeg` | recommended | `/orc:qa`, `/orc:evidence` — motion evidence; agent-browser's `record` wraps ffmpeg, so headless QA captures stills only without it |

Suppress the check where missing tools are intentional: `export ORC_SKIP_TOOL_CHECK=1`.
