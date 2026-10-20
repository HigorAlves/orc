---
description: Plan a chunk of work too big for one session as a shared map of decision tickets on the configured tracker; each session resolves exactly one decision
when_to_use: Use when an effort spans many sessions and the route isn't visible yet; /orc:plan covers single-session planning, orc:to-issues slices a settled plan.
argument-hint: "[chart <loose idea> | work <map ref> [ticket ref]]"
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
  - Bash(git remote:*)
  - Bash(git log:*)
---

# /orc:wayfinder

Chart a loose idea too big for one session as a shared map of decision tickets, then resolve one decision per session.

The way from here to the **destination** is not visible yet. Wayfinding finds that way instead of charging at the destination. The map lives on the repo's issue tracker; its **decision tickets** are questions whose resolution is a decision, not slices of a build.

Where this sits:

- `/orc:plan` — the work fits one session: draft a TDD-shaped plan now.
- `/orc:wayfinder` — the work spans many sessions and the open questions are decisions: chart, then resolve one at a time.
- `orc:to-issues` — the decisions are final: slice the settled plan into tracer-bullet implementation issues.

A finished map hands off to `/orc:plan` or `orc:to-issues`. The destination is often the spec they consume.

## Arguments

- `chart <loose idea>` — Mode A: chart the map and its first tickets on the tracker.
- `work <map ref> [ticket ref]` — Mode B: resolve one ticket. Without a ticket ref, pick the next frontier ticket.

## Preconditions

> **🛑 Tracker writes**
>
> Map creation, ticket batches and resolutions write to the tracker. A preview gate precedes every write.

> **⚠️ Caution**
>
> Other sessions work the tracker concurrently. An unclaimed ticket is fair game; claim it before any work.

- The tracker layer must be readable (`orc:tracker-config`). Phase 0 runs its missing-config gate.

## Phases

Modules live in `orc:phases` (`references/wayfinder/`). Entering a mode, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| MAP Map and ticket reference | `orc:wayfinder/MAP` | never |
| A Chart the map | `orc:wayfinder/A` | `work` |
| B Work through the map | `orc:wayfinder/B` | `chart` |

### Phase 0 — Detect context

1. Run the `orc:tracker-config` read protocol.
2. Read the "Wayfinding operations" section of `issue-tracker.md`.
3. Read `orc:wayfinder/MAP`.
4. If the argument is `chart`, Read `orc:wayfinder/A`.
5. If the argument is `work`, Read `orc:wayfinder/B`.

NOTE: where the map, child tickets, blocking edges, frontier query, claim and resolve live is tracker-specific: GitHub sub-issues plus native dependencies; Jira links via `acli`; local markdown files. `orc:tracker-config` owns the missing-config gate: one canonical ask; a defaults answer is a settled decision for the session.

## Iron rules

- Claim before work. Never work a ticket you have not assigned.
- One non-research ticket per session, even when the next one looks quick.
- No tracker write without a preview: map creation, ticket batches, resolutions.
- The map never restates a decision: gist plus link only.
- Plan, don't do. Each ticket resolves a decision; only a map **Notes** override allows deliverables.
- Refer by name with the link inside: `[Pick the session store](url)`, never a bare `#42`.

## Output

- The map and decision tickets on the configured tracker, with blocking edges.
- Per work session: one resolved ticket, an updated Decisions-so-far, a refreshed frontier.
- No `.orc/` session state. The map is the checkpoint: resume by re-invoking `/orc:wayfinder` with the map.
