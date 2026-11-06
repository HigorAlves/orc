---
name: orc-env-provisioning
description: "Provision a fast, reproducible dev environment for QA or standalone use \u2014 healthcheck-gated boot, reuse/teardown rules, host-mode fallback. Protocol for $orc-env, $orc-qa Phase 4, $orc-flow Phase 6, and the orc-env-provisioner agent."
---

Read `../../RUNTIME.md` first, then `../../content/skills/env-provisioning/SKILL.md` and follow that workflow.
Resolve paths relative to this installed skill directory. The plugin root is two directories above it.
Pass the user's arguments to the workflow. Load referenced phase modules only when needed.
