# ORC for Antigravity CLI

**Version:** 0.4.0

This directory contains the Antigravity CLI version of the ORC ecosystem. It is a direct port of the original Claude Code plugin, designed to follow the Antigravity way for state-of-the-art agentic workflows, taking full advantage of Antigravity's native support for agents, commands, and skills.

> **Convention divergence (orc ≥ 0.6.0):** the Claude Code plugin's output conventions — GitHub-flavored callouts (`[!IMPORTANT]`/`[!WARNING]`/`[!CAUTION]`/`[!NOTE]`/`[!TIP]`) and the modern hook JSON contract (`permissionDecision`) — are Claude-Code-specific and intentionally **not** mirrored here. This port also has known broken hook paths (`hooks.json` references `gemini-skills/`; `hooks/session-start.sh` reads a nonexistent `orc-core/` skill) — see `docs/roadmap.md` (C5) for the fix-or-archive decision.

## Architecture

ORC for Antigravity is built using the official plugin directory structure:
- **Agents (`agents/`)**: 10 specialized subagents (e.g., `orc-implementer`) defining system prompts, tools, and constraints.
- **Commands (`commands/`)**: 19 composite slash commands mapping the IC loop (e.g., `flow`, `plan`).
- **Domain Skills (`skills/`)**: Ported domain-specific expertise (e.g., `next-best-practices`).
- **Core Rules**: Enforced via hooks and the `using-orc` skill.

## Installation

### Via the marketplace (recommended)

Inside Antigravity:

```
/plugin marketplace add HigorAlves/orc
/plugin install orc@orc
```

### Via local plugin-dir (recommended for development on this repo)

```bash
agy plugin install /Users/higoralves/Developer/system/orc/antigravity
```

Reload after edits without restarting:

```
/reload-plugins
```

## Usage

You can trigger the ORC workflow using native slash commands or natural language:

- **Start the full loop**: `/orc:flow` or "Run the ORC flow"
- **Plan a feature**: `/orc:plan` or "Plan a new feature for [description]"
- **Run QA**: `/orc:qa` or "Execute QA for the current changes"
- **Review a PR**: `/orc:code-review` or "Review the open PR #123"

## Iron Rules

1. **No commits to main/master/develop** directly.
2. **No code without a failing test** (TDD first).
3. **No claims without verification** (run the command, check the output).
4. **No fixes without root cause** investigation.
5. **No AI attribution** in commits, code, or PRs.
6. **No multi-phase work without `.orc/` state** (checkpoint every phase).
7. **No silent broadcast in workspace mode** (explicit `--repos`/`--repo`/`--all-repos`/`--this-repo` or confirm).
8. **No PR over the size budget without a recorded choice** (default 300 LOC; over-budget prompts to stack via `orc-stack-pr`, open big with a `Size-budget-override:` trailer, or abort).

---
"Zug zug." - Let the orcs do the work.
