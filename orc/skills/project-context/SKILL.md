---
name: project-context
description: Read, write and extend docs/agents/project-context.md, the 150-line binding rules file executor agents load before code. Use with /orc:context.
---

# Project Context

`.orc/` dies at cleanup. `docs/agents/project-context.md` does not. It carries a repo's implementation conventions across branches, sessions and agents.

## What it is

- Directives to agents: "use X, never Y, here".
- Project-specific facts a model would guess wrong.
- Committed, shared with the team.

It is not documentation for humans, a plan, or session state. Architecture prose belongs in `docs/adr/`. Vocabulary belongs in `GLOSSARY.md`.

Line test: would a competent engineer new to this repo get it wrong without the line? If no, cut it. Rubric and worked example: [FORMAT.md](references/FORMAT.md).

## Cap

**150 lines / 6 KB, hard.** Executors preload this file on every task, so the cap is a per-task token cost. State the cap in the file header. `scripts/ci/verify-project-context.sh` fails above 150 lines or 6144 bytes. Cut before you add.

## Sections

Keep this order. Omit a section that would be empty.

1. Stack & versions
2. Commands (test, lint, typecheck, build)
3. Critical rules
4. Patterns to follow
5. Patterns to avoid
6. Known landmines

## Binding semantics

Critical rules are binding. A slice that needs to break one escalates. The caller decides: the rule is stale, or the slice is wrong.

Other sections are strong defaults. Deviate only with a stated reason in the slice report.

## Who reads it

- Four agents preload this skill: `orc-implementer`, `orc-test-author`, `orc-code-fixer`, `orc-qa-validator`.
- Each reads the file once, before discovery.
- `orc-stage render` injects the file into every factory stage prompt.
- It fills `context.projectContext` when the stage input leaves that field null.
- A missing file is the default state. Proceed silently, never gate on it.

## Who writes it

- `/orc:context` generates, refreshes and appends. Executors never write the file.
- `/orc:retro` proposes additions from repeated incidents.
- Each proposal passes the line test and the cap, and lands only through a gate.
