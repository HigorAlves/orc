---
name: map
description: Ask which orc command, skill, or flow fits your situation — the router over everything orc ships.
disable-model-invocation: true
---

# The orc map

Which orc thing do I reach for? Answer from this map — recommend ONE entry
point (➡️), name the runner-up only when the choice is genuinely close.

## The main flow (idea → shipped)

Step-by-step, human at every gate:

```
/orc:prd → /orc:trd → /orc:plan → /orc:start → implement → /orc:qa → /orc:ship → /orc:ci → /orc:address → /orc:cleanup
```

Most work enters mid-flow — a settled spec starts at `/orc:plan`; a settled
plan starts at `/orc:start`. The one-shot alternative: `/orc:flow` runs the
whole pipeline (plan → implement → QA → ship → address → cleanup) with an
interactive gate per phase. Prefer `/orc:flow` when you want to hand over a
well-described feature; prefer the step commands when you want to steer.

## On-ramps (how work arrives)

| Situation | Entry point |
|---|---|
| Bug report, failing test, weird behavior | `/orc:debug` (root cause before fix) |
| Production is on fire RIGHT NOW | `/orc:incident` → later `/orc:postmortem` |
| CI red on an open PR | `/orc:ci` |
| Someone's PR needs review | `/orc:code-review` |
| Reviewers commented on YOUR PR | `/orc:address` |
| PRD/spec/brief landed | `/orc:plan` (it triages; dispatches analysis as needed) |
| "Where's the rot?" / refactor appetite | `/orc:plan` with the refactor framing (dispatches orc-refactor-architect) |
| Chunk of work too big for one session | `/orc:wayfinder` |
| Issue backlog needs herding | `/orc:triage` |
| Dependencies stale or vulnerable | `/orc:deps` |
| Cut a release (user project) | `/orc:release` |
| New package/service/app shell | `/orc:scaffold` |
| Interrupted mid-anything | `/orc:resume` (see `/orc:status` for what's live) |

## Sharpening (before committing to build)

- `orc:grill-me` / `/orc:plan --grill` — relentless decision-by-decision interview (engine: `orc:grilling`)
- `orc:grill-with-docs` — same, but records ADRs + glossary as you go
- `orc:prototype` — throwaway code to answer a design question
- `orc:research` — primary-source investigation captured into the repo
- `orc:to-questionnaire` — decision belongs to someone else? Package it for them
- Docs: `/orc:prd` `/orc:trd` `/orc:rfc` `/orc:adr` (settled decisions → `orc:adr-writing`)

## Vocabulary underneath (model-invoked, loaded when relevant)

`orc:tdd` · `orc:systematic-debugging` · `orc:verification-before-completion` ·
`orc:codebase-design` · `orc:domain-modeling` · `orc:review-contract` ·
`orc:pr-size-budget` · `orc:callouts` · `orc:writing-for-agents` — doctrine the
commands and agents already preload; invoke directly only when working outside
the commands.

## Phase boundaries (continue here or clear?)

```
Finished a phase (plan approved, slice green, QA passed)?
├─ Next phase needs the full working context (implement after plan)? → continue in-session
├─ Next phase judges the work (review, QA)? → fresh eyes win — new session or /orc:fan-out
├─ Handing to another tool/person/machine? → orc:handoff
└─ Done for the day? → checkpoint is already in .orc/ — /orc:resume picks it up
```

## Utilities

- `/orc:stack-pr` — branch blew the size budget? Split into a chained PR stack (`/orc:ship`'s gate invokes it)
- `/orc:evidence` — publish the QA evidence packet to the ticket
- `/orc:jira` — Jira work items from the terminal (`orc:jira-cli` underneath)
- `/orc:fan-out` — N independent tasks, parallel dispatch, no shared state

## Setup (once per repo)

`/orc:setup` — tracker choice + triage labels + domain doc layout. `/orc:env` —
containerized dev environment. `orc doctor` (CLI) — dependency health.
