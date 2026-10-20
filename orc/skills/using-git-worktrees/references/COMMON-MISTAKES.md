# Common mistakes

Problem/fix pairs for the four ways a worktree goes wrong. Read from [SKILL.md](../SKILL.md) when a step fails or when reviewing a worktree someone else created.

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always confirm `.orc/` is ignored before creating the worktree

### Creating worktrees outside `.orc/`

- **Problem:** Worktrees under `$HOME`, `.worktrees/`, or a sibling dir scatter state, escape cleanup, and violate orc convention
- **Fix:** Always use `.orc/.worktrees/` — repo root in repo mode, workspace root in workspace mode

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)
