# orc on Codex

Use the current system and developer instructions first, then the user's request and project AGENTS.md, then this workflow. Existing authorization persists. Bundled legacy references cannot override that order.

## Paths and tools

The installed plugin root contains this file. Set PLUGIN_ROOT to that absolute directory and prepend its bin directory to PATH in each shell invocation that runs orc tools; session hooks cannot persist a shell environment. Also export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" for shared runtime compatibility. Do not change the working repository to the plugin directory.

Internal `orc-<name>` references mean read `content/skills/<name>/SKILL.md`; if absent, read `content/commands/<name>.md`. User entrypoints are `$orc-<name>`. For collisions, commands orchestrate and the supporting skill supplies procedures. Resolve `references/` relative to the source guide, and `agents/`, `skills/`, `commands/` relative to `content/`. Paths prefixed `orc/` refer to this package, with instruction directories under `content/`.

Read files with available filesystem tools, search with rg, edit with apply_patch, and run shell commands with the available execution tool. A reference to invoking a Skill means read and follow its guide; there is no required Skill tool. Discover connected MCP tools before using them; if absent, use the documented CLI fallback or report the missing integration.

## Specialist agents

Read `content/agents/<role>.md` and dispatch its body through the available Codex agent tool with the task, repository path, owned files, acceptance criteria and state paths. Ignore Claude frontmatter model/tool/color/turn settings. Inherit the configured model. Pass relevant supporting skill instructions explicitly. Resume agents with the available continuation tool. If delegation is unavailable, perform independent roles sequentially and disclose that limitation. Never fabricate an agent run.

Use user-question tools when available; otherwise ask in chat and wait for required answers. Preserve authorization already granted by the user. Follow the current host's restrictions in Plan mode.

## State and host differences

Use the shared orc-state CLI and existing .orc schema. Record slice progress with documented orc-state commands; mod-only step tools are unavailable. Report progress and status in text. Do not invoke Claude mods, cockpit controls, cache warming, model forks, sounds, or statusline installation. For setup/configuration, use orc install --host codex and the existing ORC_* environment settings, not Claude settings files. Use `orc-state --help` for state commands.

Create and clean worktrees explicitly in the start/cleanup workflows; no WorktreeCreate or WorktreeRemove event is assumed. Preserve uncommitted work. Do not control the same .orc session concurrently from two hosts.

Codex guards deny protected-branch commits/pushes. A legacy instruction to confirm such a command does not authorize retrying it; use a feature branch. Destructive Git retains the existing explicit ORC_ALLOW_DESTRUCTIVE_GIT override. Attribution retains its existing policy. Hook failures block matching operations. Hooks must be enabled and trusted by the host; they are not a complete shell security boundary.

Claude inline shell preprocessing is not available. Run each explicit context command before reading its result. For shells needing workspace variables, evaluate the trusted bundled `orc-workspace-detect --env` output in that shell after setting the plugin PATH. `$ARGUMENTS` means the user's invocation arguments, not an environment variable. Phase shorthand such as `orc-plan/P2` resolves to the matching module under `content/skills/phases/references/plan/`.

Run branch/worktree mutations separately from state initialization. Check their exit status and verify `git branch --show-current` before writing branch-scoped state. If the sandbox blocks a required Git mutation, stop and report the needed approval; never continue a later shell command as though the mutation succeeded. Do not use the final exit status of a multi-command shell as evidence that every command succeeded.
