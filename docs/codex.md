# orc for Codex

orc supports Codex CLI and the desktop app through a separate generated plugin.
Claude remains the default installer target.

## Install

After a release containing this change:

```sh
orc install --host codex
orc install --host codex --ref <tag-or-commit>
orc status --host codex
orc update --host codex
orc uninstall --host codex --yes
```

For development, register this checkout before its changes are published:

```sh
python3 scripts/codex/build.py
codex plugin marketplace add /absolute/path/to/orc
codex plugin add orc@orc-codex
codex plugin list
```

Restart the desktop app or start a new CLI session. Review the plugin's hook
trust prompt. Select orc in the plugin directory and invoke `$orc-flow`,
`$orc-plan`, `$orc-qa`, `$orc-ship`, or `$orc-resume`. All catalog workflows have
entrypoints named `$orc-<name>`. Existing command/skill name collisions expose
the command; its supporting skill stays available internally.

Python 3, Git and jq are required for the Codex hooks. Other dependencies remain
workflow-specific. The installer requires the `codex` executable and propagates
installation errors; it does not edit Codex's plugin cache. Uninstall removes
only the plugin and retains the marketplace source. `--settings` and
`--settings-only` remain Claude-only. The interactive installer, config, MCP and
statusline screens still configure Claude; use the explicit commands above for
Codex. Set existing ORC_* environment options in the Codex launch environment.

## Host behavior

| Capability | Codex behavior |
|---|---|
| Skills and command workflows | Generated entrypoints and shared reference material |
| Specialist agents | Role prompts dispatched through available Codex agent tools; configured model inherited |
| State and resume | Existing `.orc` schema and bundled CLIs |
| Protected branches | Commits and pushes denied, including initial commits |
| Destructive Git | Denied unless existing ORC_ALLOW_DESTRUCTIVE_GIT override is explicit |
| Attribution | Existing detection and override preserved |
| First-time Playwright QA | Selects agent-browser before setup; automatic Codex Playwright agent/MCP provisioning is deferred |
| Compaction | Shared mechanical checkpoint hook |
| Worktrees | Explicit workflow setup and cleanup |
| Cockpit, sounds, cache UI | Text status; Claude mod is not loaded |

Hook enforcement requires host support, enabled hooks and trust. The Codex
adapter maps shared `ask` verdicts to `deny`: current Codex does not support
`ask` for PreToolUse. Shell hooks do not inspect every possible execution path.
Do not concurrently control the same `.orc` session from different hosts.

## Development and validation

`orc/` is canonical. `scripts/codex/build.py` copies tracked runtime resources,
converts instruction references, emits Codex entrypoints, and overlays
`adapters/codex/`. The generated `codex/orc/` tree is checked in so marketplace
installation needs no build step. Run the generator before committing source
changes; CI checks exact bytes and executable modes for drift.

```sh
python3 scripts/codex/test_bundle.py
cd cli
go test ./...
```

CLI smoke evidence and remaining desktop checks: [smoke report](codex-smoke.md).

Baseline CLI: 0.166.0. Manual acceptance in both CLI and desktop: install from a
local checkout; verify catalog discovery; start a plan; dispatch an implementer;
record QA; prepare a PR without publishing; interrupt and resume from persisted
state. Verify denied Git operations in a disposable repository. Use a persistent Codex session when testing specialist dispatch; the tested
ephemeral host failed to load subagent rollout context. Desktop smoke results
must be recorded before claiming a tested app version.

References: [plugin packaging](https://developers.openai.com/plugins/build/plugins)
and [hook contracts](https://learn.chatgpt.com/docs/hooks).
