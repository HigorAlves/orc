# Execution handoff

Disclosed from `orc-writing-plans`. Read after the plan is saved: the execution-choice prompt and the sub-skill each choice requires.

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use the bundled orc-implementer role (dispatch per RUNTIME.md)
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use orc-executing-plans
- Batch execution with checkpoints for review
