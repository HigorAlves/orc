---
name: orc-stack-pr
description: "Break a too-big branch into a stack of smaller chained PRs \u2014 commit-based by default (one PR per Conventional Commit), or --smart for messy branches. Detects gh-stack, falls back to plain gh. Workspace-aware."
---

Read `../../RUNTIME.md` first, then `../../content/commands/stack-pr.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
