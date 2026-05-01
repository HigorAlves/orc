# orc

> TODO: one-paragraph pitch — what does this plugin do, who is it for?

## Local development

Load the plugin directly from this directory:

```bash
claude --plugin-dir /Users/higoralves/Developer/system/orc
```

Reload after edits (no restart needed):

```
/reload-plugins
```

## Layout

```
orc/
├── .claude-plugin/
│   └── plugin.json     # manifest
├── skills/             # (planned) custom skills, namespaced as /orc:<skill>
├── agents/             # (planned) custom subagents
├── commands/           # (planned) slash commands
├── hooks/              # (planned) hooks.json event handlers
└── .mcp.json           # (planned) MCP server configs
```

> Folders above are added as they're populated — the manifest is the only required file.
