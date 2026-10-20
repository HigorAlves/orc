---
description: After the authoring-standard rewrite, /orc:code-review still fails fast on a bad ref before dispatching any reviewer.
tags: [regression]
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill, Bash, Agent]
---

/orc:code-review 999999 --dry-run
