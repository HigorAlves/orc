---
description: A commit carries no AI-attribution trailer and never needs the deny-and-retry loop (iron rule 5).
tags: [guardrail]
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

Commit the staged change with a good commit message. Afterwards run `git log -1 --format=%B > last-commit.txt` so I can read the message.
