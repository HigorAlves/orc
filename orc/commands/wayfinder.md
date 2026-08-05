---
description: "Plan a chunk of work too big for one session as a shared map of decision tickets on the configured tracker — blocking edges render the frontier, fog-of-war holds what can't be ticketed yet, and each session resolves exactly one decision. Use when an effort spans many sessions and the route isn't visible yet; /orc:plan covers single-session planning, orc:to-issues slices a settled plan."
argument-hint: "[chart <loose idea> | work <map ref> [ticket ref]]"
license: MIT
metadata:
  author: Matt Pocock
  source: Adapted from https://github.com/mattpocock/skills @ 2ffb184
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

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This command charts the way as a **shared map** on the repo's issue tracker, then works its **decision tickets** — questions whose resolution is a decision, not slices of a build to execute — one per session until the route is clear.

## Where this sits

- **`/orc:plan`** — the work fits one session: draft a TDD-shaped plan now.
- **`/orc:wayfinder`** — the work spans many sessions and the open questions are *decisions*: chart them, resolve one at a time.
- **`orc:to-issues`** — the deciding is done: slice the settled plan into tracer-bullet implementation issues.

A finished map typically hands off to `/orc:plan` or `orc:to-issues` — the destination is often exactly the spec they consume.

## Phase 0 — Read the tracker layer

Read `docs/agents/issue-tracker.md` and consult its **"Wayfinding operations"** section — where the map, child tickets, blocking edges, frontier query, claim, and resolve physically live is tracker-specific (GitHub sub-issues + native dependencies; Jira links via `acli`; local markdown files). If the file is missing, don't hard-fail — print:

> **⚠️ Caution — tracker layer not configured**
>
> `/orc:wayfinder` stores its map on the tracker configured in `docs/agents/issue-tracker.md`. Run `/orc:setup` once to write it.

then `AskUserQuestion`: **Run /orc:setup now** (recommended) / **Use the local-markdown tracker for this map** / **Abort**.

## Principles

**Plan, don't do.** Each ticket resolves a decision; the map is done when nothing is left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its map **Notes** — absent that, produce decisions, not deliverables.

**Refer by name.** Every map and ticket has a name — its title. In everything the human reads, refer to it by name with the link riding inside (`[Pick the session store](url)`), never a bare `#42`. A wall of numbers is illegible.

**One ticket per session.** Never resolve more than one ticket per session — except research tickets, which run as background subagents.

## The map

A single tracker item (labelled `wayfinder:map`, or the tracker doc's equivalent) — the canonical artifact, loaded once per session at low resolution. It is an **index**, not a store: a decision lives in exactly one place — its ticket — and the map only gists and links it. Open tickets are not listed in the body; they're found by the tracker's frontier query.

```markdown
## Destination

<what reaching the end looks like — the spec, decision, or change this effort
is finding its way to. One or two lines; every session orients to it first.>

## Notes

<domain; skills every session should consult; standing preferences>

## Decisions so far

- [<closed ticket title>](link) — <one-line gist of the answer>

## Not yet specified

<fog of war — see below>

## Out of scope

<work ruled beyond the destination — see below>
```

### Tickets

Each ticket is a child of the map; its body is one question sized to a single fresh-context session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Each carries a `wayfinder:<type>` label. A session **claims** a ticket by assigning it *before any work* — the assignee IS the claim; open + unassigned = unclaimed. Blocking uses the tracker's **native** dependency relationship so the frontier renders visually in the tracker's own UI (fallback conventions per the tracker doc). A ticket is **unblocked** when every blocker is closed; the **frontier** is the open, unblocked, unclaimed children — the edge of the known. Answers are recorded on resolution, never pre-written into the body; assets are linked, not pasted.

### Ticket types

Every ticket is **HITL** (worked live with a human — the agent never stands in for the human's side; a grilling that answers its own questions has broken this) or **AFK** (agent-driven):

- **Research** (AFK) — surface a fact a decision waits on, from docs/APIs/knowledge bases outside the working directory. Resolved via `orc:research` as a background subagent.
- **Prototype** (HITL) — raise the fidelity of the discussion with a cheap concrete artifact to react to, via `orc:prototype`. Link the artifact as an asset.
- **Grilling** (HITL) — conversation; the default type. Always `orc:grilling` + `orc:domain-modeling`.
- **Task** (HITL or AFK) — manual work that must happen before a decision *can* be made (sign up for the service, provision access, move the data so its shape is visible). The one type that *does* rather than decides — earning its place by unblocking a decision, not delivering the destination. AFK where the agent can drive; otherwise hand the human a precise checklist. The answer records what was done and the facts later tickets depend on.

### Fog of war

The map is *deliberately* incomplete: don't chart what you can't yet see. **Not yet specified** holds the dim view — decisions you can tell are coming but can't pin down because they hang on open questions. Resolving a ticket clears fog, graduating what's now specifiable into fresh tickets. The test is whether you can state the question precisely **now** — not whether you can answer it: sharp question → ticket (even if blocked); fuzzy → fog, uncut (one patch may graduate into several tickets, or none).

### Out of scope

The destination fixes the scope; work beyond it isn't fog and never graduates. When an existing ticket turns out to sit past the destination, **close it** and leave one line in **Out of scope** — gist, why, link to the closed ticket. It stays out of Decisions-so-far, which records only the route actually walked.

## Mode A — Chart the map

Invoked with a loose idea.

1. **Name the destination.** Run `orc:grilling` + `orc:domain-modeling` to pin down what this map is finding its way to. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** — fan out across the whole space, surfacing the open decisions and the first takeable steps. **If this surfaces no fog** — the way is already clear, the journey fits one session — print the Gate headline (`**⛔ Gate — no map needed**`, per `orc:callouts`) and `AskUserQuestion`: hand off to `/orc:plan` / slice via `orc:to-issues` / chart anyway.
3. **Preview.** Print `**📋 Preview — map + tickets**`: the map body, every ticket title + type + question, and the blocking edges. `AskUserQuestion` to confirm before creating anything on the tracker.
4. **Create.** Create the map, then the specifiable tickets as children, then wire blocking edges in a **second pass** (items need ids before they can reference each other) — all per the tracker doc's wayfinding operations. Everything not yet specifiable stays in the fog section.
5. **Fire the research subagents.** For each research ticket, dispatch `orc:research` in the background to resolve it in parallel, linking findings from the ticket.
6. **Stop.** Charting is one session's work; it hand-resolves nothing.

## Mode B — Work through the map

Invoked with a map reference; a ticket reference is optional — without one, *you* pick the next decision.

1. **Load the map** — the low-res view, not every ticket body.
2. **Choose and claim.** The named ticket, else the first frontier ticket in map order. Claim it (assign) before any work — other sessions may be working the tracker concurrently, and the claim is what makes them skip it.
3. **Resolve it** — zoom as needed: fetch related or closed ticket bodies on demand; invoke the skills the map's Notes name; default to `orc:grilling` + `orc:domain-modeling`.
4. **Record.** Post the answer as a resolution comment, close the ticket, and append a gist + link to the map's Decisions-so-far. Preview tracker writes before posting.
5. **Advance the frontier.** Create newly-surfaced tickets (create-then-wire); graduate fog the answer made specifiable, clearing each graduated patch from Not-yet-specified so it lives only as its ticket; rule mis-scoped tickets out of scope; update or delete tickets the decision invalidated.

Then stop — one decision per session. Close with `**➡️ Next**`: the new frontier, one line.

## Iron rules

- Claim before work — an unclaimed ticket is fair game for concurrent sessions; never work one you haven't assigned.
- One non-research ticket per session, even when the next one looks quick.
- No tracker write without a preview — map creation, ticket batches, resolutions.
- The map never restates a decision — gist + link only.

## Output

- The map + decision tickets on the configured tracker (with blocking edges)
- Per work session: one resolved ticket, an updated Decisions-so-far, a refreshed frontier
- No `.orc/` session state — **the map is the checkpoint**: resuming means re-invoking `/orc:wayfinder` with the map, so state lives where every collaborator (and concurrent session) can see it.
