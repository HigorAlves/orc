---
name: using-git-worktrees
description: Use when starting feature work that needs isolation, or before executing an implementation plan — creates isolated git worktrees with smart directory selection and safety checks.
---

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

> [!NOTE]
> **📋 Harness-managed worktrees land in the pinned location automatically.** orc ships `WorktreeCreate`/`WorktreeRemove` hooks (`hooks/scripts/worktree-*.sh`): any worktree Claude Code itself creates (`--worktree`, or an agent with `isolation: worktree`) is placed under `<repo>/.orc/.worktrees/<sanitized-branch>` and cleaned up only when the tree is clean. This skill's manual process below applies when YOU create the worktree.

## Directory Selection Process

**Iron rule: orc worktrees always live under `.orc/.worktrees/` — at the repo root or, in workspace mode, the workspace root. Never under `$HOME`, never elsewhere.** `.orc/` is always git-ignored in an orc project, so worktree contents can never pollute the tree. There is no "ask the user where", no global location, and no CLAUDE.md location override — the location is fixed by design.

Exactly two cases:

### Workspace mode

If the caller sourced `lib/workspace-detect.sh` and `ORC_CONTEXT=workspace`, use the workspace-shared trees root, keyed per repo:

```bash
path="$ORC_WORKSPACE_ROOT/.orc/.worktrees/<repo>/<branch>"
```

Use this when the caller provides a `repo` + `branch` pair (e.g. from `/orc:start` or `/orc:flow` Phase 4 in workspace mode). Workspace-mode worktrees are always per-repo and always require a target repo — if the caller hasn't passed `repo`, treat it as repo mode for the current repo instead.

### Repo mode (default)

Otherwise use the current repo's own `.orc/.worktrees/`:

```bash
path="$(git rev-parse --show-toplevel)/.orc/.worktrees/<branch>"
```

## Safety Verification

**MUST confirm `.orc/` is ignored before creating the worktree.** It almost always is (orc scaffolds it into `.gitignore`), but verify — a worktree inside a tracked `.orc/` would get its entire checkout staged.

```bash
# Workspace mode: check the workspace root; repo mode: check the repo root.
root="${ORC_WORKSPACE_ROOT:-$(git rev-parse --show-toplevel)}"
git -C "$root" check-ignore -q .orc
```

**If NOT ignored** (non-zero exit), fix it immediately before proceeding:
1. Append `.orc/` to the root `.gitignore`
2. Commit that change
3. Then create the worktree

**Why critical:** Prevents accidentally committing worktree contents to the repository.

## Creation Steps

### 1. Resolve Roots and Branch

```bash
# Repo mode
repo_root="$(git rev-parse --show-toplevel)"

# Workspace mode: the caller supplies $ORC_WORKSPACE_ROOT, $REPO, $BRANCH_NAME.
# Project name is the explicit `repo` argument (e.g. `api`), NOT derived from
# git rev-parse (which would lose the workspace context).
```

### 2. Create Worktree

```bash
# Determine full path — always under .orc/.worktrees/, never under $HOME
if [ "$ORC_CONTEXT" = "workspace" ] && [ -n "$REPO" ]; then
  # Workspace mode: caller supplied $ORC_WORKSPACE_ROOT, $REPO, $BRANCH_NAME
  path="$ORC_WORKSPACE_ROOT/.orc/.worktrees/$REPO/$BRANCH_NAME"
  cd "$ORC_WORKSPACE_ROOT/$REPO"
else
  # Repo mode: the current repo's own .orc/.worktrees/
  path="$(git rev-parse --show-toplevel)/.orc/.worktrees/$BRANCH_NAME"
fi

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** surface a `[!WARNING]` **⚠️ Caution** callout (baseline tests already failing in the fresh worktree — findings won't be attributable to your change), then ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| Repo mode | `<repo-root>/.orc/.worktrees/<branch>` |
| Workspace mode (repo + branch given) | `<workspace-root>/.orc/.worktrees/<repo>/<branch>` |
| `.orc/` not ignored | Add `.orc/` to .gitignore + commit, then proceed |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always confirm `.orc/` is ignored before creating the worktree

### Creating worktrees outside `.orc/`

- **Problem:** Worktrees under `$HOME`, `.worktrees/`, or a sibling dir scatter state, escape cleanup, and violate orc convention
- **Fix:** Always use `.orc/.worktrees/` — repo root in repo mode, workspace root in workspace mode

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Resolve repo root: /Users/dev/myproject]
[Verify ignored - git check-ignore confirms .orc/ is ignored]
[Create worktree: git worktree add /Users/dev/myproject/.orc/.worktrees/feature-auth -b feature/auth]
[Run npm install]
[Run npm test - 47 passing]

Worktree ready at /Users/dev/myproject/.orc/.worktrees/feature-auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Red Flags

**Never:**
- Create a worktree anywhere but `.orc/.worktrees/` (repo root or workspace root)
- Create a worktree under `$HOME`, `.worktrees/`, or a sibling directory
- Create the worktree without confirming `.orc/` is ignored
- Skip baseline test verification
- Proceed with failing tests without asking

**Always:**
- Place worktrees under `.orc/.worktrees/` — repo root in repo mode, workspace root in workspace mode
- Confirm `.orc/` is ignored before creating the worktree
- Auto-detect and run project setup
- Verify clean test baseline

## Integration

**Called by:**
- **brainstorming** (Phase 4) - REQUIRED when design is approved and implementation follows
- **subagent-driven-development** - REQUIRED before executing any tasks
- **executing-plans** - REQUIRED before executing any tasks
- Any skill needing isolated workspace

**Pairs with:**
- **finishing-a-development-branch** - REQUIRED for cleanup after work complete
