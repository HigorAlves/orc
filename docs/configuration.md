# Configuration

## Plugin settings (`userConfig`)

Prompted at plugin enable time (re-run via `/plugin`); exported to hooks and libs as `CLAUDE_PLUGIN_OPTION_<KEY>`:

| Setting | Default | Effect |
|---------|---------|--------|
| `pr_size_budget` | `300` | Soft LOC budget for the ship/flow/stack-pr size gate (per-repo `.orc/pr-budget.json` still wins). |
| `protected_branches` | `main,master,develop` | Branches guarded by the confirm-to-commit hook. |
| `skip_tool_check` | `false` | Skip the SessionStart CLI dependency pre-flight. |
| `learn_from_outcomes` | `true` | Record verified debug outcomes into the local Graphify work-memory (`graphify-out/`, git-ignored) so code discovery improves across sessions. No effect when Graphify is absent. |
| `interaction_policy` | `manual` | Default autopilot level for inward gates: `manual` (every gate asks), `guided` (mechanical confirms auto-advance), `auto` (sprint contract; phases run autonomously against agreed criteria). Outward-facing gates (tracker writes, PR review posting, evidence publish) always ask regardless. |
| `statusline` | `true` | Render the orc statusline. `false` hides it even with the plugin-shipped default installed. |
| `statusline_style` | `full` | `full` (two lines, width-aware) or `compact` (always a single dense line). |
| `statusline_context_reserve` | `0` | 0–50. When >0, the context percentage is normalized against this reserved slice (e.g. your auto-compact reserve) and rendered with a `~` prefix. `0` shows the raw payload percentage. |

## Environment variables

| Variable | Effect |
|----------|--------|
| `ORC_SKIP_TOOL_CHECK=1` | Suppress the SessionStart tool-check callout when a recommended dependency is intentionally missing. |
| `ORC_ALLOW_AI_ATTRIBUTION=1` | Allow AI-attribution trailers in commits/PR bodies. The PreToolUse hook refuses them by default (iron rule #5). Set only with explicit user consent. |
| `ORC_ALLOW_DESTRUCTIVE_GIT=1` | Skip the confirm prompt on `git reset --hard`, `git clean -f`, `git branch -D`, `git push --force`. |
| `ORC_JIRA_PR_KEYWORD` | PR-body trailer keyword used by `/orc:ship` when the session has a bound Jira ticket. Defaults to `Resolves`. |

The `orc config` CLI edits these tunables (`pr_size_budget`, `protected_branches`, `skip_tool_check`, `allow_ai_attribution`, `jira_pr_keyword`) as `ORC_*` variables in `settings.json`.

## Statusline

While orc is enabled, Claude Code's status bar shows the work and the machine at a glance — no configuration needed (the plugin ships the default; your own `statusLine` in `~/.claude/settings.json` always wins):

```
orc flow 6/9 implement │ PROJ-142 │ slices 3/7 │ auto │ ⎇ feat/checkout-retry* │ #128 ✔ approved
Opus 4.5 high think │ ctx ▓▓▓▓▓▓▓░░░ 68% │ $4.83 +412/−88 │ 5h 71%
```

Line 1 is the work: the live orc session (command, phase, label), bound Jira ticket, slice-ledger progress, autopilot level, git branch (`*` = dirty), and the branch's open PR with its review state — all from the session payload and one cached git probe; no `gh` calls, ever. Line 2 is the machine: model + reasoning effort, an honest context bar (the raw payload percentage — set `statusline_context_reserve` to normalize against your auto-compact reserve, shown with a `~`), session cost with lines added/removed, and your worst rate limit once it passes 50%. It adapts to terminal width, honors `NO_COLOR`, falls back to ASCII on non-UTF-8 locales, and never breaks a render — every path exits clean.

The statusline also feeds the **context-monitor bridge**: it's the only surface that sees context usage, so it shares that with a PostToolUse hook that gives the agent an advisory nudge ("consider checkpointing") when context runs red — once per tier, never imperative.

Tune via the `userConfig` keys above (`statusline`, `statusline_style`, `statusline_context_reserve`). Prefer an explicit user-level entry over the plugin-shipped default? `orc statusline install|uninstall|status` (the CLI never clobbers a statusline it doesn't own).
