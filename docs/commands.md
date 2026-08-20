# What orc can do

The full catalog: every slash command, the specialist agents behind them, the skill library underneath, and the CLI that installs it all. Not sure where to start? The [examples index](examples/README.md) maps 18 real scenarios to the command that handles each.

## Commands (30)

| Command | Purpose |
|---------|---------|
| **`/orc:flow`** | **Recommended entry point.** Drives the full lifecycle (plan → start → implement → QA → ship → address → cleanup) with a gate at every phase. Resumable from any phase. |
| `/orc:plan` | Plan a feature/refactor; writes a TDD-shaped plan to `.orc/<branch>/files/` |
| `/orc:start` | Worktree + plan + first failing test (TDD red light) |
| `/orc:debug` | Root-cause investigation, then fix with TDD; never papers over |
| `/orc:qa` | Pre-PR quality gate; for web changes, full browser QA with screenshots/snapshot/HAR/steps |
| `/orc:env` | Provision a containerized dev environment; `up`/`status`/`down`; reused across QA runs |
| `/orc:code-review` | Review someone else's open PR; terse, signal-only output |
| `/orc:address` | Answer reviewer comments on YOUR PR; parallel code-fixer + reply-drafter |
| `/orc:ship` | Finalize and open the PR (soft size-budget gate) |
| `/orc:stack-pr` | Split a too-big branch into a stack of smaller chained PRs |
| `/orc:fan-out` | Dispatch independent tasks in parallel sub-sessions |
| `/orc:scaffold` | Bootstrap a new package/service with README + Diátaxis docs |
| `/orc:resume` | Pick up an interrupted multi-phase command from its checkpoint |
| `/orc:status` | Show all active `.orc/` workspaces |
| `/orc:adr` · `/orc:rfc` | Author an ADR / a system-design RFC |
| `/orc:prd` · `/orc:trd` | Author a PRD / a TRD (supports `--from-jira` / `--from-prd`) |
| `/orc:jira` | Manage Jira tickets via `acli`; bind/unbind a ticket to the current session |
| `/orc:jira-breakdown` | Build a Jira Epic (micro-PRD) → Stories → concurrency-sliced Tasks from a brief or PRD |
| `/orc:evidence` | Collect browser evidence scoped to a ticket, then upload or keep local |
| `/orc:postmortem` | Author a blameless incident postmortem; files P0 items as tracker issues |
| `/orc:ci` | Watch + diagnose CI after PR-open; classified failures routed to `orc-code-fixer` |
| `/orc:incident` | Live incident triage — Sentry intake, mitigate-vs-root-cause gate, UTC timeline |
| `/orc:deps` | Dependency audit / outdated / upgrade — one bump per commit, majors escalated |
| `/orc:release` | Cut a user-project release: semver from commits, changelog, tag, GitHub release |
| `/orc:setup` | Run-once tracker/labels/domain-docs interview; powers to-issues, triage, wayfinder |
| `/orc:triage` | Herd issues + external PRs through triage roles into agent-ready briefs |
| `/orc:wayfinder` | Plan multi-session work as decision tickets on the tracker |
| `/orc:cleanup` | Remove `.orc/` state, worktree, and (if merged) branch for completed sessions |

## Specialist agents (14)

`orc-implementer` (writes code slice-by-slice), `orc-debug-investigator`, `orc-test-author`, `orc-code-fixer`, `orc-pr-reviewer`, `orc-security-reviewer`, `orc-ci-investigator`, `orc-qa-validator`, `orc-env-provisioner`, `orc-prd-analyzer`, `orc-refactor-architect`, `orc-jira-architect`, `orc-reply-drafter`, `orc-stack-analyzer` — each a read-only investigator or a scoped executor, dispatched by the commands above. Every agent pins both a `model` (haiku for mechanical work, sonnet for senior-dev execution, opus for deep investigation) and a reasoning `effort` matched to its task shape.

## Skills (80)

Under the commands and agents sit 80 curated skills — reusable, progressively-disclosed playbooks the model pulls in on demand: process doctrine (`tdd`, `systematic-debugging`, `verification-before-completion`, `grilling`, `codebase-design`, `domain-modeling`), stack packs (Next.js, NestJS, PostgreSQL, SwiftUI, Tailwind, Turborepo, …), authoring guides (PRD/TRD/ADR/RFC/postmortem), and the `orc:map` router when you're not sure which to reach for. Fifteen are vendored or merged from [mattpocock/skills](https://github.com/mattpocock/skills) and other MIT sources with full provenance ([THIRD-PARTY-LICENSES.md](../THIRD-PARTY-LICENSES.md)); their descriptions are deliberately differentiated so co-installing the originals doesn't double-trigger. Each skill is a thin index that loads its detail only when invoked, so they cost almost nothing until used. **Total: 80 skills.**

## The orc CLI

A small Go / [Bubble Tea](https://github.com/charmbracelet/bubbletea) TUI that installs and configures everything. Every command runs non-interactively too (`--yes`/`--json`), so it fits CI:

```bash
orc                       # interactive menu (install, doctor, config, MCP, tools)
orc install               # register marketplace + enable the plugin
orc doctor --fix          # check and install missing runtime tools
orc config set pr_size_budget 500
orc mcp add github --token "$GITHUB_TOKEN"   # known: github, jira, sentry, vercel, graphify
orc statusline install    # explicit user-level statusline entry (plugin default needs none)
orc update                # update to latest (or --to <ref> to repin)
```

See [`cli/README.md`](../cli/README.md) for the full command reference.
