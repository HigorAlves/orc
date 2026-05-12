# ORC for Gemini CLI

This directory contains the Gemini CLI version of the ORC ecosystem. It is a modularized port of the original Claude Code plugin, designed to follow Gemini CLI best practices for token efficiency and progressive disclosure.

## Architecture

ORC for Gemini is built using a **Modular Skill Pack** architecture:
- **Command Skills (19)**: Each original `/orc:<command>` is now an independent Gemini CLI skill (e.g., `orc-flow`, `orc-plan`).
- **Subagent Skills (10)**: Specialized personas (e.g., `orc-implementer`) that wrap the `invoke_agent` tool.
- **Domain Skills (54)**: Ported domain-specific expertise (e.g., `next-best-practices`).
- **Core Rules**: Enforced via the `orc-core` skill and the hook system.

## Installation

### 1. Link the local directory (Recommended for development)
To link this entire directory so that changes you make here are reflected immediately in Gemini CLI:

```bash
gemini skills link gemini-skills/
```

### 2. Install from the local directory
To copy the skills to your user or workspace scope:

```bash
# Workspace scope (local to this project)
gemini skills install gemini-skills/ --scope workspace

# User scope (global for all projects)
gemini skills install gemini-skills/ --scope user
```

### 3. Install from GitHub
Once you push these changes to a repository, others can install them directly:

```bash
gemini skills install https://github.com/YourUsername/orc.git --path gemini-skills/
```

### 4. Configure Hooks
ORC relies on hooks to enforce iron rules and inject context. Copy the provided `hooks.json` to your project's `.gemini/` directory:

```bash
mkdir -p .gemini
cp gemini-skills/hooks.json .gemini/hooks.json
```

### 5. Reload Gemini CLI
Inside an interactive Gemini CLI session, reload the skills to enable them:

```
/skills reload
```

## Usage

You can trigger the ORC workflow using natural language. Gemini CLI will semantically match your intent to the correct skill.

- **Start the full loop**: "Run the ORC flow" or "Start orc:flow"
- **Plan a feature**: "Plan a new feature for [description]"
- **Run QA**: "Execute QA for the current changes"
- **Review a PR**: "Review the open PR #123"

## Iron Rules

1. **No commits to main/master/develop** directly.
2. **No code without a failing test** (TDD first).
3. **No claims without verification** (run the command, check the output).
4. **No fixes without root cause** investigation.
5. **No AI attribution** in commits, code, or PRs.

---
"Zug zug." - Let the orcs do the work.
