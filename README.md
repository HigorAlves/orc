# orc

> Personal Claude Code plugin orchestrating the **plan → debug → verify → ship** loop with curated skills and slash commands.

## What it does

`orc` is a personal-workflow plugin: 42 curated skills, 11 composite slash commands, 6 specialist subagents, and 2 hooks that quietly enforce discipline (no commits to `main`, skill catalog injected at every session start).

It exists for one reason: every time a senior developer sits down to work, they should already know how the next hour goes — write the plan, watch the test fail, fix the cause (not the symptom), verify with evidence, ship the PR. orc encodes that loop.

## Install / load locally

```bash
claude --plugin-dir /Users/higoralves/Developer/system/orc
```

Reload after edits without restarting:

```
/reload-plugins
```

## Day-one command catalog

| Command | Purpose |
|---------|---------|
| `/orc:plan` | Plan a feature/refactor; writes a TDD-shaped plan to `.orc/<branch>/files/` |
| `/orc:start` | Worktree + plan + first failing test (TDD red light) |
| `/orc:debug` | Root-cause investigation, then fix with TDD; never papers over |
| `/orc:qa` | Pre-PR quality gate; for web changes, full browser QA with screenshots/video/steps |
| `/orc:code-review` | Review someone else's open PR; terse, signal-only output |
| `/orc:address` | Answer reviewer comments on YOUR PR; parallel code-fixer + reply-drafter |
| `/orc:ship` | Finalize and open the PR |
| `/orc:fan-out` | Dispatch independent tasks in parallel sub-sessions |
| `/orc:scaffold` | Bootstrap a new package/service with proper README + Diátaxis docs |
| `/orc:resume` | Pick up an interrupted multi-phase command from its checkpoint |
| `/orc:status` | Show all active `.orc/` workspaces |
| `/orc:adr` | Author an Architecture Decision Record (`docs/adr/NNNN-*.md`) |
| `/orc:rfc` | Author a system-design RFC pre-implementation (`docs/rfcs/NNNN-*.md`) |
| `/orc:postmortem` | Author a blameless incident postmortem; files P0 action items as tracker issues |
| `/orc:cleanup` | Remove `.orc/` state, worktree, and (if merged) branch for completed sessions |

## Skill catalog

**Core (17, always available):** `tdd`, `systematic-debugging`, `verification-before-completion`, `writing-plans`, `executing-plans`, `caveman-review`, `receiving-code-review`, `requesting-code-review`, `git-commit`, `gh-cli`, `using-git-worktrees`, `finishing-a-development-branch`, `dispatching-parallel-agents`, `error-handling-patterns`, `git-advanced-workflows`, `architecture-patterns`, `improve-codebase-architecture`.

**Senior/architect practice (3, authored for orc):** `adr-writing` (Architecture Decision Records), `rfc-writing` (system-design RFCs), `postmortem` (blameless incident postmortems).

**Pack: web-react (7):** `next-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `frontend-design`, `shadcn`, `tailwind-design-system`, `vitest`.

**Pack: backend (8):** `nodejs-best-practices`, `nestjs-best-practices`, `typescript-advanced-types`, `postgresql-table-design`, `postgresql-optimization`, `postgresql-code-review`, `stripe-best-practices`, `upgrade-stripe`.

**Pack: ios (2):** `swiftui-pro`, `mobile-ios-design`.

**Pack: workflow-extras (11):** `docker-expert`, `turborepo`, `sentry-cli`, `skill-creator`, `write-a-skill`, `documentation-writer`, `create-readme`, `to-prd`, `to-issues`, `grill-me`, `agent-browser` (drives a real browser for `/orc:qa` web mode).

Plus the meta skill `using-orc` (auto-injected at SessionStart, encodes iron rules). **Total: 49 skills.**

## Insight blocks

When orc is writing or modifying code, it surfaces 2–3 short, codebase-specific notes inline using:

```
`★ Insight ─────────────────────────────────────`
[2–3 short, codebase-specific insights]
`─────────────────────────────────────────────────`
```

This is baked into `skills/using-orc/SKILL.md` and injected at every SessionStart, so orc is self-sufficient — no separate explanatory-output-style plugin required.

## Iron rules (enforced by hooks + the using-orc skill)

1. No commits to `main`/`master`/`develop` without `ORC_ALLOW_PROTECTED=1`.
2. No code without a failing test first.
3. No claims without verification (run the command, read the output).
4. No fixes without a found root cause.
5. No AI attribution in code, commits, or PRs.
6. No multi-phase work without `.orc/` checkpoints.

## Web QA evidence is a hard rule

Any web-surface change going through `/orc:qa` MUST produce, in `.orc/<branch>/files/qa/`:

- `screenshot-NN-<step>.png` per visible step (annotated via `agent-browser screenshot --annotate`)
- `snapshot-final.txt` — accessibility tree from `agent-browser snapshot`
- `console.log` — captured browser console (errors flagged)
- `network.har` — network traffic from `agent-browser network har start/stop`
- `steps.md` — narrated golden path + edge cases

Bonus (optional): `trace.json`, `react-renders.json`, `vitals.json`, or an OS-recorded `video.mov` for animated changes. agent-browser does not record video natively.

Without the required artifacts, "QA passed" is not an accepted claim. The `orc-qa-validator` agent — driven by the [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) CLI via the `orc:agent-browser` skill — produces them.

## Layout

```
orc/
├── .claude-plugin/plugin.json   # manifest
├── .orc/                        # gitignored — workspace state per session
├── skills/<name>/SKILL.md       # 42 skills
├── commands/<name>.md           # 11 slash commands
├── agents/orc-<role>.md         # 6 subagents
├── hooks/
│   ├── hooks.json
│   └── scripts/                 # session-start-using-orc.sh + pre-commit-branch-check.sh
├── lib/                         # shared prompt fragments + templates
├── docs/                        # architecture.md, contributing.md, adr/
├── skills-database/             # curation source (kept during dev, archived pre-publish)
└── skills-old/                  # legacy mirror (archived pre-publish)
```

## Development

See `docs/contributing.md` for conventions on adding skills, commands, agents, and hooks.

See `docs/architecture.md` for the why behind the layout and the `.orc/` lifecycle.

## License

MIT — see `LICENSE`.
