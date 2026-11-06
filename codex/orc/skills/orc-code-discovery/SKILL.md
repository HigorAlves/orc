---
name: orc-code-discovery
description: "Use when discovering or navigating a codebase before planning, implementing, debugging, or refactoring \u2014 prefer a Graphify code-graph query over broad Glob/Grep/Read to cut token cost, with automatic fallback to grep when Graphify is absent, stale, or unhealthy."
---

Read `../../RUNTIME.md` first, then `../../content/skills/code-discovery/SKILL.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
