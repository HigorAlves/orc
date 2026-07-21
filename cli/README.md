# orc CLI

A small [Bubble Tea](https://github.com/charmbracelet/bubbletea) TUI + command
suite that streamlines installing and configuring the
[orc](https://github.com/HigorAlves/orc) Claude Code plugin — and the runtime
tools it relies on.

## Install

```bash
brew install HigorAlves/tap/orc                                              # Homebrew
curl -fsSL https://raw.githubusercontent.com/HigorAlves/orc/main/cli/install.sh | sh  # bootstrap
go install github.com/HigorAlves/orc/cli/cmd/orc@latest                      # Go
```

## Commands

Run `orc` with no arguments on a terminal to open the interactive menu.
Everything is also available non-interactively (add `--yes`/`--json` for
scripts and CI):

| Command | What it does |
|---|---|
| `orc install` | Register the marketplace + enable the plugin (via the `claude` CLI, or `--settings-only`/`--ref` to write `~/.claude/settings.json` directly). |
| `orc update [--to <ref>]` | Update to latest, or repin a version in settings.json. |
| `orc uninstall [-y]` | Remove orc's plugin + marketplace entries. |
| `orc doctor [--fix] [--json]` | Check required/recommended tools; `--fix` installs the missing ones via your package manager. |
| `orc config [get\|set\|unset]` | View/edit tunables (`pr_size_budget`, `protected_branches`, `skip_tool_check`, `allow_ai_attribution`, `jira_pr_keyword`) as `ORC_*` vars in settings.json's `env` block. |
| `orc mcp [list\|add\|remove\|known]` | Manage MCP servers via the `claude` CLI; `orc mcp add github --token …` for the curated GitHub MCP. |
| `orc version` | Print the CLI version. |

## Safety

- `settings.json` edits preserve all unknown keys, are written atomically
  (temp file + rename), and back up the prior file to `settings.json.bak`.
- Malformed `settings.json` is never overwritten — the CLI errors instead.

## Development

```bash
go test ./...     # unit + command tests
go vet ./...
gofmt -l .        # must print nothing

# release dry-run (requires goreleaser)
goreleaser release --snapshot --clean
```

The tool registry (`internal/deps/tools.json`) is a CI-verified mirror of the
canonical `orc/lib/tools.json` that the plugin's SessionStart hook also reads —
edit the canonical file and re-copy the mirror.
