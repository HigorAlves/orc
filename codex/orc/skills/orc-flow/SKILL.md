---
name: orc-flow
description: "End-to-end feature/bug/refactor pipeline (plan \u2192 start \u2192 implement \u2192 QA \u2192 ship \u2192 address \u2192 cleanup) with an interactive gate at every phase. Resumable via $orc-resume. --jira (KEY) links a ticket. Workspace-aware."
---

Read `../../RUNTIME.md` first, then `../../content/commands/flow.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
