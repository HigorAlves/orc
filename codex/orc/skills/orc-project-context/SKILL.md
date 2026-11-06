---
name: orc-project-context
description: "Read, write and extend docs/agents/project-context.md, the 150-line binding rules file executor agents load before code. Use with $orc-context."
---

Read `../../RUNTIME.md` first, then `../../content/skills/project-context/SKILL.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
