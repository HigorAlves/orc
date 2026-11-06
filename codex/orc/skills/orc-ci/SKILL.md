---
name: orc-ci
description: "Diagnose and fix a red CI run \u2014 dispatches orc-ci-investigator, then routes on its verdict: auto-fix via orc-code-fixer, flake re-run, infra escalation, or $orc-debug hand-off"
---

Read `../../RUNTIME.md` first, then `../../content/commands/ci.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
