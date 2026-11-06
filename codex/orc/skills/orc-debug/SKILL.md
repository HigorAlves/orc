---
name: orc-debug
description: "Systematic root-cause investigation, then fix with TDD \u2014 never proposes a fix before finding the cause; resumable diagnosis + regression test in .orc/ state. Workspace-aware. For a quick one-off look without session state, prefer the bundled /debug."
---

Read `../../RUNTIME.md` first, then `../../content/commands/debug.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
