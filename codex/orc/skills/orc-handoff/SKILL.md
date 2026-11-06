---
name: orc-handoff
description: "Compact the current conversation into a redacted handoff document, saved to the OS temp dir, that a fresh agent in another session or tool can pick up \u2014 $orc-resume is the counterpart for resuming in-repo orc state."
---

Read `../../RUNTIME.md` first, then `../../content/skills/handoff/SKILL.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
