# Examples and quick reference

Companion to [SKILL.md](../SKILL.md): the situation → action table, a worked session transcript, and the skills that call this one.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Repo mode | `<repo-root>/.orc/.worktrees/<branch>` |
| Workspace mode (repo + branch given) | `<workspace-root>/.orc/.worktrees/<repo>/<branch>` |
| `.orc/` not ignored | Add `.orc/` to .gitignore + commit, then proceed |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Resolve repo root: /Users/dev/myproject]
[Verify ignored - git check-ignore confirms .orc/ is ignored]
[Create worktree: git worktree add /Users/dev/myproject/.orc/.worktrees/feature-auth -b feature/auth]
[Run npm install]
[Run npm test - 47 passing]

Worktree ready at /Users/dev/myproject/.orc/.worktrees/feature-auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Integration

**Called by:**
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- **subagent-driven-development** - REQUIRED before executing any tasks
- **executing-plans** - REQUIRED before executing any tasks
- Any skill needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** - REQUIRED for cleanup after work complete
