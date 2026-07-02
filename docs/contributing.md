# Contributing to orc

orc is a personal plugin, but the conventions here keep future-you sane. Read them before adding anything.

## Iron rules (mirror `skills/using-orc/SKILL.md`)

1. No commits to `main`/`master`/`develop` — the PreToolUse hook downgrades them to a confirm prompt; approve only with explicit user consent. (The full 8-rule list lives in `skills/using-orc/SKILL.md`; these five are the ones that bite contributors.)
2. New skills get a failing test before they ship (the test is "does invoking this skill produce the expected behavior?" — usually a manual smoke test for skills).
3. Don't claim a feature works without verifying. The plugin must `claude --plugin-dir` load cleanly.
4. Don't fix a bug in a skill without finding the root cause first. Don't paper over.
5. No AI attribution in commits, PRs, or skill bodies.

## Adding a new skill

1. Create `skills/<kebab-case-name>/SKILL.md`.
2. Frontmatter required:
   ```yaml
   ---
   name: <kebab-case-name>
   description: One sentence — when should the model invoke this skill?
   ---
   ```
3. The body is the instructions the model follows when the skill triggers.
4. For "rich" skills, add supporting files in the same directory: `references/*.md` for progressive-disclosure detail, `rules/*.md` for granular rules, `scripts/*` for executables.
5. The skill's `description:` frontmatter is its only trigger surface — Claude Code loads every description automatically; there is no catalog table to update. Spend the effort making the description say *when* to invoke it.
6. Reload: `/reload-plugins` inside Claude Code.

## Adding a new command

1. Create `commands/<kebab-case-name>.md` (no extension confusion — Markdown only).
2. Frontmatter required:
   ```yaml
   ---
   description: One-line summary shown in /orc: autocomplete
   argument-hint: "<expected-args-format>"
   allowed-tools:
     - Read
     - Glob
     - Grep
     - Skill
     - Bash(git *)         # be specific
     - Bash(gh pr view:*)  # whitelist the verb
   ---
   ```
3. The body describes the workflow as numbered phases. Each phase invokes a skill, dispatches a `Task`, or asks the user via `AskUserQuestion`.
4. **State-aware commands** must write to `.orc/<sanitized-branch>/files/` after every phase. Update `checkpoint.md` and the central `.orc/orc.json` registry.
5. No catalog table to update — the command's `description:` frontmatter is what surfaces in `/orc:` autocomplete.
6. Reload.

## Adding a new subagent

1. Create `agents/orc-<role>.md`. The `orc-` prefix is required (avoids namespace collisions with user-level agents).
2. Frontmatter required:
   ```yaml
   ---
   name: orc-<role>
   description: When should this agent be dispatched?
   tools: Read, Glob, Grep, Bash(git log:*)   # least privilege
   model: opus | sonnet | haiku                # opus for deep reasoning, sonnet for execution, haiku for cheap checks
   color: red | blue | green | purple | orange | cyan
   maxTurns: 15-50
   disallowedTools: Write, Edit, NotebookEdit  # for read-only investigator agents (permissionMode is IGNORED for plugin agents — don't use it)
   ---
   ```
3. The body describes the role, what it looks for, output format, tone.
4. Tools whitelist: never grant blanket `Bash`. Use `Bash(npm *:*)`, `Bash(gh pr view:*)`, etc.
5. The agent is invoked via `Task` from a command — not directly by the user.

## Adding a hook

1. Add a script to `hooks/scripts/<event>-<purpose>.sh`. Make it executable (`chmod +x`).
2. Wire it in `hooks/hooks.json` — add an `"if"` permission-rule filter so the script only spawns for the commands it guards:
   ```json
   "PreToolUse": [
     {
       "matcher": "Bash",
       "hooks": [
         { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<your-script>.sh", "async": false, "if": "Bash(git commit*)" }
       ]
     }
   ]
   ```
3. Use `${CLAUDE_PLUGIN_ROOT}` for all paths — keeps the plugin relocatable.
4. The script reads tool input as JSON on stdin and always exits 0. Decisions go on stdout as JSON: PreToolUse hooks emit `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow|deny|ask", "permissionDecisionReason": "…"}}`; SessionStart hooks emit `hookSpecificOutput.additionalContext` (model-facing) and/or top-level `systemMessage` (user-facing). See existing scripts for the contract.
5. Let jq own the JSON encoding (`jq -n --arg …`) — no hand-rolled escaping.

## File-naming conventions

- All files: kebab-case (`my-skill.md`, not `MySkill.md` or `my_skill.md`).
- Subagents: `orc-<role>.md`.
- Skills: directory named after the skill, contains `SKILL.md` and supporting files.
- Commands: `<command-name>.md` directly under `commands/`.

## Testing locally

```bash
claude --plugin-dir /Users/higoralves/Developer/system/orc
# inside Claude Code:
/reload-plugins
/orc:                  # autocomplete should list all 20 commands
```

## Commit hygiene

- Conventional Commits format (enforced by `orc:git-commit` skill): `feat(skills): ...`, `fix(commands): ...`, `chore(hooks): ...`.
- One logical change per commit. Don't bundle unrelated work.
- Never `--amend` after pushing. Never `git push --force` to a shared branch.

## When you change something

If you change a skill's name, description, or invocation surface, update:
1. Any command in `commands/` that references it.
2. `docs/architecture.md` if the change affects the high-level shape.
3. The README skill catalog and the counts in `.claude-plugin/marketplace.json`.

Drift between these surfaces is the most common bug in personal plugins. Run `claude plugin validate ./orc --strict` before pushing.
