---
description: "Intake for any report (issue, PR, Jira, Sentry, paste): check it is valid, then brief, file, park or reject it"
when_to_use: Use when a report, ticket, Sentry issue or message arrives, or the backlog needs triage.
argument-hint: "[<issue/PR number, Jira key, or request> | --sentry <id|url> | <pasted report>]"
license: MIT
metadata:
  author: Matt Pocock
  source: Adapted from https://github.com/mattpocock/skills @ 5beb35b
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh:*)
  - Bash(acli:*)
  - Bash(jq:*)
  - Bash(curl:*)
  - Bash(git rev-parse:*)
  - Bash(git log:*)
  - Bash(git fetch:*)
  - Bash(sentry:*)
  - Bash(git switch:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(go:*)
  - Bash(cargo:*)
  - Bash(pytest:*)
---

# /orc:triage

The intake for every incoming report: categorise it, check it is valid, grill when needed, then brief, file, park or reject it.

## Arguments

- `<issue/PR number, Jira key, or natural-language request>` — optional. A bare `#42` resolves to an issue or a PR per the tracker config.
- `--sentry <id|url>` — a Sentry issue short ID or URL. Read-only intake via `orc:triage/P4`.
- `<pasted report>` — a chat message, email, stack trace or complaint with no tracker item. Intake via `orc:triage/P4`.

Natural-language routing: "Show me anything that needs my attention" → P1; "Let's look at #42" or "look at PROJ-123" → P2; "Is this real?" plus a paste → P4; "Move #42 to ready-for-agent" → P3; "What's ready for agents to pick up?" → query and list.

## Preconditions

> **🛑 Outward write**
>
> Every tracker write (label, comment, close) sits behind a `📋 Preview — tracker writes` gate. It is hard-outward per `orc:using-orc`; `--auto` and `interaction_policy` never skip it.

- The tracker layer must exist; `orc:tracker-config` owns the missing-config gate (one canonical ask per session).
- A "use defaults" answer is a settled decision: no tracker-aware command re-asks this session.
- A PR is an issue with attached code: same roles, states and machine. PR deltas: `orc:triage/P2`, `orc:triage/BRIEFS`.

## Phases

Modules live in `orc:phases` (`references/triage/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Attention queue | `orc:triage/P1` | the request names an item or a state move |
| 2 Triage a specific item | `orc:triage/P2` | attention queue (until a pick) or quick override |
| 3 Quick state override | `orc:triage/P3` | the request is not "move X to <state>" |
| 4 Intake a raw report | `orc:triage/P4` | the input is a tracker item |
| Validity check | `orc:triage/VALIDITY` | never in P2 and P4 |
| Roles and transitions | `orc:triage/ROLES` | the run writes no role |
| Briefs and triage notes | `orc:triage/BRIEFS` | no brief or notes to post |
| Out-of-scope KB | `orc:triage/OUT-OF-SCOPE` | never; P2 reads it, rejected enhancements write it |

### Phase 0 — Detect context

1. Run the `orc:tracker-config` read protocol: `issue-tracker.md` and `triage-labels.md`.
2. Read `docs/agents/domain.md`; follow its consumer rules in every codebase exploration.
3. Pick the tracker dispatch from the table below.
4. Route the request per the Arguments section.
5. On "what's ready for agents?", query the tracker and list the items.

| Tracker | Read via | Triage state written as |
|---|---|---|
| GitHub | `gh` (`orc:gh-cli`): issues and external PRs | labels, comments, closes |
| Jira | `acli` (`orc:jira-cli`); external PRs in scope still via `gh` | Jira labels per `triage-labels.md` |
| Local markdown | the issue files the config points at | `Status:` / `Category:` lines and `## Comments` sections |

NOTE: PRs enter discovery only when the config's "PRs as a request surface" flag is `yes`. An explicitly named PR always enters triage. Consumer rules from `domain.md`: glossary vocabulary, ADR awareness.

Every triaged item carries exactly one category role and one state role, per `orc:triage/ROLES`.

## Iron rules

- No tracker write without the preview gate: every comment, label change and close shows verbatim and confirms first.
- The validity check never writes: reproduce and run tests; never commit fixes. Fixes are `/orc:debug` or `/orc:flow` work.
- Never resolve, ignore, assign, merge or comment on a Sentry issue.
- Suggest the next command; never start it.
- No AI attribution in any posted comment, brief, or close message.
- Session state lives on the tracker (triage-note comments), never in `.orc/`. A raw report keeps no state until filed.
- Resuming means re-reading the item's notes, checking what the reporter answered, and presenting an updated picture.

## Output

- A validity verdict for every report, and a suggested next command.
- Tracker writes (labels, briefs, triage notes, closes, filed raw reports), each behind its preview gate.
- `docs/agents/out-of-scope.md` entries for rejected enhancements.
- Updated `GLOSSARY.md` and ADRs when grilling resolved domain terms (via `orc:domain-modeling`).
