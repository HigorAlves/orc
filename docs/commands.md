# What orc can do

The full catalog: every slash command, the specialist agents behind them, the skill library underneath, and the CLI that installs it all. Not sure where to start? The [examples index](examples/README.md) maps 19 real scenarios to the command that handles each.

## Commands (29)

| Command | Purpose |
|---------|---------|
| **`/orc:flow`** | **Recommended entry point.** Drives the full lifecycle (plan → start → implement → QA → ship → address → cleanup) with a gate at every phase. Resumable from any phase. |
| `/orc:plan` | Plan a feature/refactor; writes a TDD-shaped plan to `.orc/<branch>/files/` |
| `/orc:start` | Worktree + plan + first failing test (TDD red light) |
| `/orc:debug` | Root-cause investigation, then fix with TDD; never papers over |
| `/orc:qa` | Pre-PR quality gate; web changes run Playwright-first browser QA against a named target (`--target`) with a stitched step-tagged video, traces, and committed e2e specs/tests |
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
| `/orc:explain` | Narrated walkthrough video of a QA packet — Playwright demo clips + animate graphics + local kokoro voice. Graphic segments are authored: orc writes the piece metadata and brief, the session writes `src/scenes.js` per the notes in `orc/lib/explain/animate.lock` (pinned animate commit), then renders with `ORC_ANIMATE_RENDER=1`. |
| `/orc:postmortem` | Author a blameless incident postmortem; files P0 items as tracker issues |
| `/orc:ci` | Watch + diagnose CI after PR-open; classified failures routed to `orc-code-fixer` |
| `/orc:incident` | Live incident triage — Sentry intake, mitigate-vs-root-cause gate, UTC timeline |
| `/orc:deps` | Dependency audit / outdated / upgrade — one bump per commit, majors escalated |
| `/orc:release` | Cut a user-project release: semver from commits, changelog, tag, GitHub release |
| `/orc:setup` | Run-once tracker/labels/domain-docs interview; powers to-issues, triage, wayfinder |
| `/orc:triage` | Herd issues + external PRs through triage roles into agent-ready briefs |
| `/orc:wayfinder` | Plan multi-session work as decision tickets on the tracker |
| `/orc:cleanup` | Remove `.orc/` state, worktree, and (if merged) branch for completed sessions |
| `/orc:retro` | Retrospective on a session — environment changes (checks, standards, pointers, tool economy), most severe first; applies or files them |

Three of these (`/orc:code-review`, `/orc:cleanup`, `/orc:incident`) are piloted as skill directories with their phase modules beside them (ADR 0008); they are invoked the same way and counted as skills.

### How a command is built

Every command follows one anatomy: a one-sentence title, Arguments, Preconditions (the warnings for the whole run), a Phases table with Phase 0 resident, Iron rules, Output. Phases past Phase 0 are modules loaded one at a time from `orc:phases` (`references/<command>/PHASE-<N>-<NAME>.md`), so a command costs a few KB on entry and the rest only when reached. Every gate is an `AskUserQuestion` with a header chip naming its class: hard-outward gates (tracker writes, PR posts, evidence publish) always ask; soft-inward ones follow the `interaction_policy` ladder. The writing rules are in the [authoring standard](../orc/skills/skill-writing/references/AUTHORING-STANDARD.md).

## Specialist agents (14)

`orc-implementer` (writes code slice-by-slice), `orc-debug-investigator`, `orc-test-author`, `orc-code-fixer`, `orc-pr-reviewer`, `orc-security-reviewer`, `orc-ci-investigator`, `orc-qa-validator`, `orc-env-provisioner`, `orc-prd-analyzer`, `orc-refactor-architect`, `orc-jira-architect`, `orc-reply-drafter`, `orc-stack-analyzer` — each a read-only investigator or a scoped executor, dispatched by the commands above. Every agent pins both a `model` (haiku for mechanical work, sonnet for senior-dev execution, opus for deep investigation) and a reasoning `effort` matched to its task shape.

## Skills (87)

Under the commands and agents sit 87 curated skills: progressively disclosed playbooks the model pulls in on demand. Each carries a `description` (what it does) and a `when_to_use` (the triggers), which is how the model routes to it; the body loads only when it fires. **Total: 87 skills.**

| Family | Skills |
|---|---|
| Doctrine the commands and agents preload | `using-orc`, `tdd`, `systematic-debugging`, `verification-before-completion`, `grilling`, `codebase-design`, `domain-modeling`, `writing-plans`, `executing-plans`, `dispatching-parallel-agents`, `receiving-code-review`, `requesting-code-review`, `writing-for-agents`, `skill-writing` |
| Protocols shared by several commands | `gates`, `callouts`, `state-protocol`, `tracker-config`, `phases`, `pr-size-budget`, `review-contract`, `inline-review`, `browser-qa`, `playwright-qa`, `qa-targets`, `env-provisioning`, `evidence-publish`, `ci-routing`, `stack-pr`, `workspace-mode`, `code-discovery`, `using-git-worktrees`, `finishing-a-development-branch`, `git-commit` |
| Authoring guides | `prd-writing`, `trd-writing`, `adr-writing`, `rfc-writing`, `postmortem-writing`, `doc-writing`, `documentation-writing`, `readme-writing`, `caveman-pr`, `caveman-review`, `release-management`, `dependency-management`, `jira-hierarchy`, `to-issues`, `to-prd` |
| Standalone, reach for any time | `map` (the router), `grill-me`, `grill-with-docs`, `prototype`, `research`, `wizard`, `handoff`, `wait-what`, `to-questionnaire`, `improve-codebase-architecture`, `resolving-merge-conflicts`, `explainer` |
| Stack packs | `next-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `nodejs-best-practices`, `nestjs-best-practices`, `typescript-advanced-types`, `vitest`, `tailwind-design-system`, `shadcn`, `postgresql-table-design`, `postgresql-optimization`, `stripe-best-practices`, `swiftui-best-practices`, `mobile-ios-design`, `docker-best-practices`, `turborepo`, `architecture-patterns`, `error-handling-patterns` |
| CLI references | `gh-cli`, `jira-cli`, `sentry-cli`, `agent-browser` |
| Commands piloted as skill directories | `code-review`, `cleanup`, `incident` ([ADR 0008](adr/0008-commands-as-skills.md)) |

Fifteen are vendored or derived from [mattpocock/skills](https://github.com/mattpocock/skills) and other MIT sources with provenance frontmatter and the licences in [THIRD-PARTY-LICENSES.md](../THIRD-PARTY-LICENSES.md); their descriptions are differentiated so co-installing the originals does not double-trigger.

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
