---
name: orc-cleanup
description: "Clean up after completed or abandoned orc sessions \u2014 removes workspace state, registry entry, git worktree, and optionally the merged branch. Destructive; always previews and asks first. Workspace-aware."
---

Read `../../RUNTIME.md` first, then `../../content/skills/cleanup/SKILL.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
