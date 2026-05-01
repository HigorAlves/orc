# orc — architecture

## Goal

`orc` is a personal Claude Code plugin built around one loop: **plan → debug → verify → ship**. Every component (skills, commands, agents, hooks) exists to keep the user moving along that loop without dropping discipline (TDD, root-cause debugging, evidence-before-claims).

## Components

```
orc/
├── .claude-plugin/plugin.json     # manifest — what Claude Code reads to discover the plugin
├── .orc/                          # gitignored, ephemeral workspace state (per-session)
├── skills/                        # 50 skills, namespaced /orc:<name>
├── commands/                      # 16 composite slash commands /orc:<cmd> (incl. /orc:flow umbrella)
├── agents/                        # 10 specialist subagents (orc-<role>)
├── hooks/                         # SessionStart + PreToolUse(Bash) hooks
├── lib/                           # shared prompt fragments + templates (cross-skill)
└── docs/                          # this directory
```

## Why the four-component split

| Layer | Role | Example |
|-------|------|---------|
| **Skills** | Reusable knowledge units the model can invoke on demand. | `orc:tdd` is invoked any time the user starts new code. |
| **Commands** | Thin orchestrators with a known shape. Each composes 2+ skills and (often) writes to `.orc/`. | `/orc:debug` invokes `systematic-debugging` → `tdd` → `error-handling-patterns`. |
| **Agents** | Long-running specialists with isolated context. Used when work needs a fresh window. | `orc-debug-investigator` is dispatched by `/orc:debug` to find root cause without polluting the main session. |
| **Hooks** | Run automatically (no user invocation). Establish discipline at session start; intercept dangerous operations. | `pre-commit-branch-check` refuses commits to `main`. |

## SessionStart hooks (two scripts, same matcher)

`hooks/hooks.json` wires two scripts to the `startup|resume|clear|compact` matcher:

1. **`session-start-using-orc.sh`** — reads `skills/using-orc/SKILL.md` and emits it as additional session context. The model sees orc's iron rules, skill catalog, and the insight-block format before its first response. The `★ Insight ─────...` block was previously delivered by a sibling plugin (`explanatory-output-style/`); folding it into `using-orc/SKILL.md` collapses that into one hook and makes orc self-sufficient on this dimension.

2. **`session-start-tool-check.sh`** — pre-flight check for orc's CLI dependencies (`git`, `jq`, `gh`, `agent-browser`). Silent when everything's present; otherwise injects a `⚠ Tool check ─────...` block and instructs the model to surface it once at session start. Suppress with `ORC_SKIP_TOOL_CHECK=1`. Adding new tooling checks later is additive — drop another script alongside.

## PreToolUse(Bash) hook

`hooks/scripts/pre-commit-branch-check.sh` intercepts every Bash tool call. If the command is `git commit` or `git push` and the current branch is `main`/`master`/`develop`, it exits 2 with a clear error. Override with `ORC_ALLOW_PROTECTED=1` for the rare case (initial scaffold, hot-fix to a release branch, etc.).

## `.orc/` workspace state

Multi-phase commands (`/orc:plan`, `/orc:start`, `/orc:debug`, `/orc:fan-out`, web-mode `/orc:qa`) checkpoint after every phase. State lives in `.orc/<sanitized-branch>/files/`:

```
.orc/
├── orc.json                                 # central registry of active sessions
└── feat-142-notification-prefs/
    └── files/
        ├── checkpoint.md                    # phase + status — the resume entry point
        ├── orc.json                         # per-session metadata
        ├── plan.md                          # if /orc:plan ran
        ├── diagnosis.md                     # if /orc:debug ran
        ├── progress.md                      # phase-by-phase log
        ├── qa/                              # if web-mode /orc:qa ran
        │   ├── screenshot-NN-step.png
        │   ├── video.mp4
        │   ├── steps.md
        │   └── console.log
        └── fan-out/                         # if /orc:fan-out ran
            ├── task-NN-slug/result.md
            └── summary.md
```

`.orc/` is gitignored. State is **personal** and **ephemeral** — its purpose is pause/resume across sessions, not artifacts for a team.

### Lifecycle

1. **Init** — first invocation creates the directory, writes `checkpoint.md` (phase=1, status=in_progress), and registers in `.orc/orc.json`.
2. **Update** — every phase writes its artifact and bumps `checkpoint.md`.
3. **Resume** — `/orc:resume` reads `orc.json`, picks a session, jumps to next phase.
4. **Status** — `/orc:status` reads `orc.json` (read-only); never modifies.
5. **Cleanup** — done sessions stay until manually `rm -rf .orc/<branch>/`.

## Web QA evidence (a hard rule)

Any change touching a web surface goes through `/orc:qa --web` (or auto-detected). The `orc-qa-validator` agent drives a real browser via the [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) CLI (loaded via the `orc:agent-browser` skill), capturing **required** artifacts:
- per-step `screenshot-NN-<step>.png` (use `--annotate` to overlay element refs `@eN`)
- `snapshot-final.txt` — accessibility tree at end of run (from `agent-browser snapshot`)
- `console.log` — browser console output (from `agent-browser console`)
- `network.har` — network traffic (from `agent-browser network har start/stop`)
- `steps.md` — narrated golden-path + edge cases

Optional bonus artifacts (NOT required): `trace.json` (Chrome DevTools), `react-renders.json`, `vitals.json`, OS-recorded `video.mov`. agent-browser does not record video natively; use `screencapture -v` (macOS) or similar when video is genuinely needed.

No "QA passed" claim is accepted without the required artifacts in `.orc/<branch>/files/qa/`. `orc:verification-before-completion` enforces this.

## Stack scope

Curated skills cover four optional packs (all enabled): `web-react` (incl. vitest), `backend` (Node/NestJS/Postgres/Stripe), `ios` (SwiftUI), `workflow-extras` (Docker/Turborepo/Sentry/skill-authoring/PRD-issue tooling/agent-browser).

Plus three skills authored fresh for senior/architect practice: `adr-writing` (Architecture Decision Records), `rfc-writing` (system-design RFCs), `postmortem` (blameless incident postmortems).

## Relationship to compozy

orc borrows compozy's session-state idea, hook layout, and YAML-frontmatter conventions. It diverges in two places:
1. Workspace state is **hidden + gitignored** (`.orc/`) instead of committed (`compozy/`). orc is a personal plugin; nothing needs sharing.
2. Command surface is smaller and more focused on the personal loop (11 commands vs compozy's 13), with explicit web-QA evidence as a first-class concern.

## See also

- `docs/contributing.md` — how to add a new skill, command, or agent
- `README.md` — user-facing catalog
- `skills/using-orc/SKILL.md` — iron rules (also injected at SessionStart)
