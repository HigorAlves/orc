---
name: using-orc
description: Use when starting any conversation — establishes orc's iron rules, skill routing, and workspace-state discipline. Required reading at every SessionStart; injected by hook.
---
<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance an orc skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

orc skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, direct requests) — highest priority
2. **orc skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

If CLAUDE.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## How to Access Skills

Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you — follow it directly. Never use the Read tool on skill files.

## Iron Rules

These apply at all times, regardless of context:

1. **No commits to main/master/develop** — ALWAYS create a feature or fix branch first. Check the current branch before ANY commit. If on a protected branch, create and switch to a new branch BEFORE making changes. The PreToolUse(Bash) hook enforces this; override only with `ORC_ALLOW_PROTECTED=1` and only with the user's explicit consent.
2. **No code without a failing test** — Write the test first. Watch it fail. Then implement. Defer to `orc:tdd` for mechanics.
3. **No claims without verification** — Run the command, read the output, THEN claim the result. Defer to `orc:verification-before-completion`.
4. **No fixes without root cause** — Find why it's broken before changing code. Defer to `orc:systematic-debugging`.
5. **No AI attribution** — Never mention Claude, AI, or automation in code, commits, or PRs. Never add `Co-Authored-By` trailers or any co-author references to commits.
6. **No multi-phase work without `.orc/` state** — Any command that takes more than one phase (`/orc:plan`, `/orc:start`, `/orc:debug`, `/orc:fan-out`, `/orc:qa` for web) MUST checkpoint after every phase to `.orc/<sanitized-branch>/files/checkpoint.md` and register the session in `.orc/orc.json`. State must survive interruption — `/orc:resume` depends on it.
7. **No silent broadcast in workspace mode** — When the SessionStart banner reports `orc context: workspace[…]`, repo-touching commands (`/orc:flow`, `/orc:plan`, `/orc:start`, `/orc:ship`, `/orc:address`, `/orc:qa`, `/orc:debug`, `/orc:cleanup`, `/orc:resume`, `/orc:code-review`, `/orc:fan-out`) MUST NOT operate on more than the cwd's repo without an explicit flag (`--repos`, `--repo`, `--all-repos`, `--this-repo`) or a confirming `AskUserQuestion`. Defer to `orc:workspace-mode` for the precedence rules.
8. **No PR over the size budget without a recorded choice** — Default budget is **300 LOC** (additions + deletions, post-exclusion — lockfiles, generated code, snapshots, build artifacts, and migrations don't count). `/orc:ship` and `/orc:flow` Phase 7 compute the diff vs the base and, when over budget, prompt the user with three options: **stack** via `/orc:stack-pr`, **open big** with a one-line `Size-budget-override:` PR-body trailer, or **abort**. Configurable via `$ORC_PR_LOC_BUDGET` or `<repo>/.orc/pr-budget.json#budget`. Bypassable per-invocation with `--no-size-gate` (emergencies only). Defer to `orc:pr-size-budget` for mechanics.

## Web QA evidence (hard rule)

For any change touching a web surface, `/orc:qa` MUST drive a real browser via the `orc:agent-browser` skill (which wraps the [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) CLI) — not just inspect code or run unit tests. The `orc-qa-validator` agent is responsible for:

1. Booting (or attaching to) the running app at a URL provided by the user.
2. Walking the **golden path** for the changed feature.
3. Walking **edge cases** (failure states, empty states, validation, slow network, auth states).
4. Capturing required artifacts to `.orc/<branch>/files/qa/`:
   - `screenshot-<NN>-<step>.png` per visible step (use `agent-browser screenshot --annotate` so refs `@eN` overlay each interactive element)
   - `snapshot-final.txt` — final accessibility tree from `agent-browser snapshot`
   - `console.log` — captured browser console (errors and warnings flagged)
   - `network.har` — captured network from `agent-browser network har start/stop`
   - `steps.md` — numbered narrative: what was tested, expected vs. actual, links to each screenshot
5. Optional bonus evidence (NOT required): `trace.json` (Chrome DevTools), `react-renders.json`, `vitals.json`, an OS-recorded `video.mov` for animated changes.

No "QA passed" claim is accepted without the required artifacts in `qa/`. `orc:verification-before-completion` enforces this. agent-browser does NOT record video natively; if the change is animation-heavy and you need a video, capture an OS screen recording (e.g. `screencapture -v` on macOS) into `qa/video.mov`.

## Workspace mode

A **workspace** is a parent directory that contains 2+ sibling git repos under one logical product (e.g. `~/work/myapp/{api,ui,docs}`). The SessionStart hook auto-detects it and emits an `orc context: workspace[…]` banner; the same context is exposed to commands via `lib/workspace-detect.sh`.

In workspace mode:

- Shared state (the cross-repo plan, checkpoint, registry) lives at `<workspace>/.orc/`. Per-repo state stays at `<repo>/.orc/` and carries a `workspace-link.json` back-pointer.
- Repo-touching commands take `--repos a,b` (broadcast), `--repo a` (narrow), `--all-repos` (skip prompt + broadcast), or `--this-repo` (pin to cwd). Default when no flag is given: prompt via `AskUserQuestion`.
- `orc-implementer`, `orc-code-fixer`, `orc-test-author`, `orc-pr-reviewer`, `orc-qa-validator`, `orc-debug-investigator` all accept `repo` + `repoPath` inputs. Sibling repos are awareness-only — agents never edit across the boundary.
- `/orc:ship` opens N PRs and second-passes each with reciprocal cross-links + merge order.

Defer to `orc:workspace-mode` for full mechanics, branch-collision handling, and backward-compat rules.

## Available Skills

| Skill | When to use |
|-------|-------------|
| `orc:tdd` | Before writing any production code — new features, bug fixes, refactoring |
| `orc:systematic-debugging` | When encountering any bug, test failure, or unexpected behavior |
| `orc:verification-before-completion` | Before claiming work is complete, fixed, or passing |
| `orc:writing-plans` | When you have a spec or requirements for a multi-step task, before touching code |
| `orc:executing-plans` | When executing a written plan with review checkpoints |
| `orc:caveman-review` | When reviewing PR diffs — terse, signal-only comments |
| `orc:caveman-pr` | When writing a PR description — terse, signal-only body (paired with `/orc:ship --caveman`) |
| `orc:receiving-code-review` | When receiving review feedback — verify before implementing |
| `orc:requesting-code-review` | When completing major work before merging |
| `orc:git-commit` | When committing — intelligent staging + Conventional Commits |
| `orc:gh-cli` | When interacting with GitHub from CLI (PRs, issues, Actions) |
| `orc:using-git-worktrees` | When starting feature work that needs isolation |
| `orc:finishing-a-development-branch` | When implementation is complete and ready to integrate |
| `orc:dispatching-parallel-agents` | When facing 2+ independent tasks that can run concurrently |
| `orc:error-handling-patterns` | When implementing error handling, designing APIs, or improving resilience |
| `orc:git-advanced-workflows` | When rebasing, cherry-picking, bisecting, using reflog/worktrees — senior git daily-driver |
| `orc:architecture-patterns` | When designing or refactoring across modules — Clean Architecture, Hexagonal, DDD applied |
| `orc:improve-codebase-architecture` | When the codebase needs structural review against ADRs/CONTEXT.md — drives `orc-refactor-architect` |
| `orc:adr-writing` | When locking in a non-trivial architectural decision — authors `docs/adr/NNNN-*.md` |
| `orc:rfc-writing` | When designing a system/feature pre-implementation — authors `docs/rfcs/NNNN-*.md` to surface alternatives |
| `orc:postmortem` | After a production incident — blameless postmortem with timeline, root causes, action items |
| `orc:prd-writing` | When authoring a Product Requirements Document from scratch — interview-driven scaffolding, publishes to `docs/prds/NNNN-*.md` |
| `orc:trd-writing` | When formalizing a technical contract derived from a PRD before RFC/plan — publishes to `docs/trds/NNNN-*.md` |
| `orc:inline-review` | When posting a real GitHub PR review with inline comments + suggestion blocks; defines the severity → event mapping rule that prevents "approve while flagging bugs" contradictions. Used by `/orc:code-review`. |
| `orc:workspace-mode` | When working in a parent dir that contains multiple sibling git repos (e.g. `~/work/myapp/{api,ui}`) — flag precedence, per-repo agent dispatch, linked-PR mechanics, branch-collision recovery |
| `orc:pr-size-budget` | When opening or sizing a PR — defines the soft 300 LOC iron-rule budget, exclusion list, and the canonical gate prompt shared by `/orc:ship`, `/orc:flow`, and `/orc:stack-pr` |
| `orc:stack-pr` | When breaking a too-big branch into a stack of smaller chained PRs — commit-based default, `--smart` agent-reshape path, `gh-stack` detection, recovery via backup branch |

Stack-specific skills (load when working in that stack):

| Pack | Skills |
|------|--------|
| **web-react** | `orc:next-best-practices`, `orc:vercel-react-best-practices`, `orc:vercel-composition-patterns`, `orc:frontend-design`, `orc:shadcn`, `orc:tailwind-design-system`, `orc:vitest` |
| **backend** | `orc:nodejs-best-practices`, `orc:nestjs-best-practices`, `orc:typescript-advanced-types`, `orc:postgresql-table-design`, `orc:postgresql-optimization`, `orc:postgresql-code-review`, `orc:stripe-best-practices`, `orc:upgrade-stripe` |
| **ios** | `orc:swiftui-pro`, `orc:mobile-ios-design` |
| **workflow-extras** | `orc:docker-expert`, `orc:turborepo`, `orc:sentry-cli`, `orc:jira-cli`, `orc:inline-review`, `orc:skill-creator`, `orc:write-a-skill`, `orc:documentation-writer`, `orc:create-readme`, `orc:to-prd`, `orc:to-issues`, `orc:grill-me`, `orc:agent-browser` |

## Available Commands

| Command | Purpose | Writes `.orc/`? |
|---------|---------|------|
| `/orc:flow` | **End-to-end pipeline** — drives plan → start → implement → QA → ship → address → cleanup with interactive gates at every phase. Recommended entry point. | ✅ |
| `/orc:plan` | Plan a feature/refactor — produces a TDD-shaped plan | ✅ |
| `/orc:start` | Start a feature — worktree + plan + first failing test | ✅ |
| `/orc:debug` | Systematic root-cause investigation, then fix with TDD | ✅ |
| `/orc:qa` | Pre-PR quality gate; for web changes, full browser QA with evidence | ✅ (web) |
| `/orc:code-review` | Review SOMEONE ELSE'S PR via gh CLI | — |
| `/orc:address` | Answer reviewer comments on YOUR open PR | — |
| `/orc:ship` | Finalize and open the PR (Phase 4.5 size-gate prompts to stack / open-big-with-reason / abort when over budget) | — |
| `/orc:stack-pr` | Break a too-big branch into a stack of smaller chained PRs (commit-based default; `--smart` for messy branches) | writes `linkedPRs[]` ✅ |
| `/orc:fan-out` | Dispatch parallel independent tasks | ✅ |
| `/orc:scaffold` | Bootstrap a new package/service with README + docs | — |
| `/orc:resume` | Resume an interrupted multi-phase orc command | reads ✅ |
| `/orc:status` | Show all active `.orc/` workspaces | reads ✅ |
| `/orc:adr` | Author an Architecture Decision Record (`docs/adr/NNNN-*.md`) | — |
| `/orc:rfc` | Author a system-design RFC pre-implementation (`docs/rfcs/NNNN-*.md`) | ✅ |
| `/orc:postmortem` | Author a blameless incident postmortem; files P0 action items as tracker issues | ✅ |
| `/orc:cleanup` | Remove `.orc/` state, worktree, and (if merged) branch for completed sessions | writes ✅ |
| `/orc:prd` | Author a Product Requirements Document (`docs/prds/NNNN-*.md`) | — |
| `/orc:trd` | Author a Technical Requirements Document (`docs/trds/NNNN-*.md`) | — |
| `/orc:jira` | Manage Jira tickets via `acli` (create/subtask/link/view/search/transition); `bind`/`unbind` attach a ticket key to the current `.orc/` session | bind/unbind ✅ |

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```mermaid
flowchart TD
    msg([User message received])
    decide{Might any orc<br/>skill apply?}
    invoke[Invoke Skill tool]
    announce["Announce: 'Using [skill] to [purpose]'"]
    follow[Follow skill exactly]
    respond([Respond])

    msg --> decide
    decide -->|yes, even 1%| invoke
    decide -->|definitely not| respond
    invoke --> announce
    announce --> follow
```

## Red Flags

These thoughts mean STOP — you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "QA already passed in unit tests" | Web change → browser-driven QA with `.orc/<branch>/files/qa/` artifacts. |
| "I'll skip the checkpoint, this is quick" | If it's multi-phase, write `.orc/` state — interruptions happen. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (debugging, TDD, verification) — these determine HOW to approach the task
2. **Implementation skills second** — these guide execution

"Build X" → design first (`orc:writing-plans`), then implementation skills.
"Fix this bug" → debugging first (`orc:systematic-debugging`), then TDD (`orc:tdd`) for the fix.

## Skill Types

**Rigid** (`tdd`, `systematic-debugging`, `verification-before-completion`): Follow exactly. Don't adapt away discipline.

**Flexible** (`using-git-worktrees`, `dispatching-parallel-agents`): Adapt principles to context.

The skill itself tells you which.

## Insights

When writing or modifying code, surface brief educational notes about non-obvious choices — in the surrounding codebase or in the change itself. Use this exact format — a GitHub-flavored `IMPORTANT` callout so Claude Code's TUI renders it with a colored left bar (typically purple) instead of plain white text:

```
> [!IMPORTANT]
> **★ Insight**
>
> - [point 1, codebase-specific]
> - [point 2]
> - [optional point 3]
```

The `> [!IMPORTANT]` prefix is the load-bearing markup — it's what triggers the color treatment. Don't drop it in favor of an inline-code-wrapped frame; that renders as plain monospace text, not as a themed block. If a future renderer doesn't theme callouts, the format degrades gracefully to a labeled blockquote.

Rules:

- **2–3 bullets max.** Each bullet one line, occasionally two. Aggressively cut.
- **Codebase- or change-specific.** Quote a file:line, name an actual symbol, point at a real trade-off in *this* repo. Skip generic programming knowledge — the user already knows what a closure is.
- **Inline, not at the end.** Drop insights as you write the code, where they explain a choice you just made — not as a postscript summary.
- **Conversation only.** Insights go in the chat, never as comments in source files.
- **Skip on simple turns.** Don't insert insight blocks for one-shot factual questions, status checks, or pure conversation. They belong with substantive code or design work.
- **Skip when nothing's interesting.** A boring boilerplate change doesn't need an insight. Forced insights become noise.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
