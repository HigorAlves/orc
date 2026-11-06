---
name: orc-resume
description: "Resume an interrupted multi-phase orc command from its last checkpoint. Reads .orc/orc.json for active sessions, picks one, jumps to the next pending phase. Workspace-aware."
---

Read `../../RUNTIME.md` first, then `../../content/commands/resume.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
