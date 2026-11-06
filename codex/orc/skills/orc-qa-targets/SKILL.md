---
name: orc-qa-targets
description: "Resolve WHERE browser QA runs \u2014 named targets in .orc/targets.json (local, staging, preview), the Target gate, credential references (literal | op:// | env:), guard rule"
---

Read `../../RUNTIME.md` first, then `../../content/skills/qa-targets/SKILL.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
