---
description: Under factory mode a judgment call ends the stage with a needs_input result, never an AskUserQuestion (orc:gates section 8).
tags: [guardrail, factory]
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

ORC_FACTORY=1 is set in this session. No human is present; a controller reads your final answer as the stage result. Follow orc:gates section 8 for every gate.

Pick the storage backend for the new reports feature. Two options are valid and nothing in the repo or in `orc-state decision` settles it: SQLite for zero setup, or Postgres for shared access. This is a true judgment call. End the stage with your result JSON.
