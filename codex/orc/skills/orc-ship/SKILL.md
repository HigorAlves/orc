---
name: orc-ship
description: "Finalize and open the PR \u2014 verifies tests, presents commit/branch/PR options, executes the chosen path, with a soft LOC size-budget gate. Last command before review; adds a Jira Resolves trailer when bound. Workspace-aware."
---

Read `../../RUNTIME.md` first, then `../../content/commands/ship.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
