---
description: Write or refresh docs/agents/project-context.md, the binding rules file executor agents load before code.
argument-hint: "[generate|show|refresh|add-rule] [\"<rule text>\"] [--section <name>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git log:*)
  - Bash(git status:*)
  - Bash(graphify:*)
  - Bash(date:*)
  - Bash(wc:*)
  - Bash(jq:*)
---

# /orc:context

Maintain `docs/agents/project-context.md`, the committed file that survives every branch. Contract, sections, cap and line rubric live in `orc:project-context`.

## Arguments

- `generate` (default): interview the repo and write the file. Refuses when the file exists.
- `show`: print the file and its size against the cap. Read-only.
- `refresh`: re-derive the file and gate on the diff.
- `add-rule "<text>"`: append one rule. `/orc:retro` calls this path.
- `--section <name>`: with `add-rule`, the target section.

## Preconditions

- Invoke `orc:project-context` first.
- Target path is `docs/agents/project-context.md` in the current repo.
- A missing file is not an error for `show`: say so and offer `generate`.

## Workflow

### generate

1. Prime discovery per `orc:code-discovery`; fall back to Glob and Grep silently.
2. Derive the stack from manifests, lockfiles and CI runtimes.
3. Derive the test, lint, typecheck and build commands from CI scripts, Makefile and package scripts.
4. Derive conventions from the real source tree. The code wins over the README.
5. Derive binding rules from CI gate scripts, hooks and `CONTRIBUTING.md`.
6. Drop every line that fails the rubric in the FORMAT.md reference of `orc:project-context`.
7. Write the cap in the file header: 150 lines / 6 KB.
8. Print the gate below, then the full draft.
9. Write the file only after approval.
10. Print the size line.

> **⛔ Gate — project context**
>
> <n> lines against the 150-line cap, path `docs/agents/project-context.md`.

Ask with `AskUserQuestion`: Write it, Trim first, Cancel. This gate asks at every autopilot level. The file steers every later agent.

### refresh

1. Read the existing file.
2. Keep every `<!-- human -->` line and everything under `## Notes` untouched.
3. Re-derive the rest as in generate steps 1 to 6.
4. Say "project-context.md is current" and stop when nothing differs.
5. Gate on the diff with `AskUserQuestion`: accept all, pick hunks, cancel.
6. Write the file and print the size line.

### add-rule

1. Run the rule through the four rubric tests; refuse a failing rule and name the test.
2. Offer to replace an existing line that covers the same ground.
3. Pick the section: prohibition to Patterns to avoid, gate requirement to Critical rules, surprise to Known landmines.
4. Stop and ask when the append passes 150 lines: cut a stale rule, or cancel.
5. Append the rule and print the size line.

## Iron rules

- Never write past 150 lines or 6144 bytes.
- Never overwrite human-marked lines.
- Never write the file without the gate; only `add-rule` skips the full-draft gate.
- Never stage or commit the file; committing is the user's call.

## Output

- `docs/agents/project-context.md`, written or unchanged.
- One size line: `<n> lines / <n> bytes (cap 150 lines / 6144 bytes)`.
