---
name: orc-qa
description: "Pre-PR quality gate \u2014 browser-driven QA for web changes with a mandatory evidence packet against a provisioned environment. No QA-passed claim without artifacts. Workspace-aware. For a quick behavioral check without the evidence packet, prefer the bundled /verify or /run."
---

Read `../../RUNTIME.md` first, then `../../content/commands/qa.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
