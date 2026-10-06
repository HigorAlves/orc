---
description: A multi-phase command registers .orc state through orc-state before planning work (iron rule 6).
tags: [state]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Agent, AskUserQuestion]
---

/orc:plan --auto add a slugify(s) helper in slug.js that lowercases, trims, and joins words with dashes, with node:test tests
