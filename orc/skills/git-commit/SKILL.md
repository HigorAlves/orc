---
name: git-commit
description: "Execute git commit with conventional-commit analysis, intelligent staging, and message generation from the diff. Use when the user asks to commit changes, create a git commit, or mentions /commit."
license: MIT
allowed-tools: Bash
---

# Git Commit with Conventional Commits

## Overview

Create standardized, semantic git commits using the Conventional Commits specification. Analyze the actual diff to determine appropriate type, scope, and message.

## Conventional Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Commit Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build system/dependencies      |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

## Breaking Changes

```
# Exclamation mark after type/scope
feat!: remove deprecated endpoint

# BREAKING CHANGE footer
feat: allow config to extend other configs

BREAKING CHANGE: `extends` key behavior changed
```

## Workflow

### 1. Analyze Diff

```bash
# If files are staged, use staged diff
git diff --staged

# If nothing staged, use working tree diff
git diff

# Also check status
git status --porcelain
```

### 2. Stage Files (if needed)

If nothing is staged or you want to group changes differently:

```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Stage by pattern
git add *.test.*
git add src/components/*

# Interactive staging
git add -p
```

**Never commit secrets** (.env, credentials.json, private keys).

### 3. Generate Commit Message

Analyze the diff to determine:

- **Type**: What kind of change is this?
- **Scope**: What area/module is affected?
- **Description**: One-line summary of what changed (present tense, imperative mood, <72 chars)

### Caveman bodies (the default)

The subject carries the *what*; the diff shows the *how*. The body exists only for the *why* that neither shows — and most commits don't have one. Default to **no body**.

When a body earns its place:

- **≤ 3 short lines** (or bullets). A body that needs paragraphs is a PR description or a doc, not a commit message.
- **Why only.** The motivating bug, constraint, or decision — one line each.
- Never restate the diff ("adds X, renames Y" — the diff says so).
- Never narrate correctness ("this ensures", "now properly", "tests confirm") — CI and the reviewer decide that.
- Never tour the files touched. Never marketing voice.
- Trailers (`Refs #N`, `Size-budget-override:`) go last, unchanged.

```
# Wrong — essay body
feat(hooks): pre-git-guard dispatcher

git push --force on a protected branch used to spawn two PreToolUse
prompts (branch-check + destructive-check both wired to git push*).
A new dispatcher runs all three checks against the incoming command
and merges verdicts into at most one decision: deny > ask, reasons
joined with ALSO. hooks.json collapses 9 wirings to 7 unique...

# Right — caveman body
feat(hooks): pre-git-guard dispatcher — one prompt per guarded command

Force-push on protected branches double-prompted (two matchers, one command).
Merge rule: deny > ask; reasons joined with ALSO.
```

### 4. Execute Commit

```bash
# Single line
git commit -m "<type>[scope]: <description>"

# Multi-line with body/footer
git commit -m "$(cat <<'EOF'
<type>[scope]: <description>

<optional body>

<optional footer>
EOF
)"
```

## Best Practices

- One logical change per commit
- Present tense: "add" not "added"
- Imperative mood: "fix bug" not "fixes bug"
- Reference issues: `Closes #123`, `Refs #456`
- Keep description under 72 characters
- No body by default; when present, caveman rules above (≤3 lines of why)

## No AI attribution (overrides Claude Code default)

orc iron rule #5. Never include any of the following in commit messages:

- `Co-Authored-By: Claude …`
- `Co-Authored-By: <noreply@anthropic.com>` (any email at anthropic.com)
- `🤖 Generated with [Claude Code](…)` (or any "Generated with" line)
- Any other mention of Claude, AI, or automation as the author

This **overrides** Claude Code's default system-prompt instruction to add
those trailers. The orc PreToolUse hook
(`pre-commit-no-ai-attribution.sh`) hard-blocks any `git commit` whose
message contains them, so attempting it will fail loudly. Don't try.

Override only with explicit user consent: `ORC_ALLOW_AI_ATTRIBUTION=1`.

## Git Safety Protocol

- NEVER update git config
- NEVER run destructive commands (--force, hard reset) without explicit request
- NEVER skip hooks (--no-verify) unless user asks
- NEVER force push to main/master
- If commit fails due to hooks, fix and create NEW commit (don't amend)
