<!-- orc:wayfinder/MAP -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Map and ticket reference

Shared by orc:wayfinder/A and orc:wayfinder/B. Read it once per session, before the mode module.

## Principles

- **Plan, don't do.** Each ticket resolves a decision. The map is complete when nothing remains to decide before someone goes and does the thing. The pull to just do the work signals the edge of the map: time to hand off. A map's **Notes** can override this; absent that, produce decisions, not deliverables.
- **Refer by name.** Every map and ticket has a name: its title. In everything the human reads, use the name with the link riding inside (`[Pick the session store](url)`), never a bare `#42`. A wall of numbers is illegible.
- **One ticket per session.** Never resolve more than one ticket per session. Research tickets are the exception: they run as background subagents.

## The map

One tracker item labelled `wayfinder:map` (or the tracker doc's equivalent). It is the canonical artifact, loaded once per session at low resolution. It is an **index**, not a store: a decision lives in exactly one place, its ticket, and the map only gists and links it. Open tickets do not appear in the body; the tracker's frontier query finds them.

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

## Tickets

Each ticket is a child of the map. Its body is one question sized to a single fresh-context session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

- Each ticket carries one `wayfinder:<type>` label.
- `wayfinder:` labels are the only labels a map and its tickets carry. Never a triage label like `ready-for-agent`: tickets are decisions, not implementation work.
- A session **claims** a ticket by assigning it, before any work. The assignee IS the claim; open + unassigned = unclaimed.
- Blocking uses the tracker's **native** dependency relationship, so the frontier renders in the tracker's own UI. Fallback conventions per the tracker doc.
- A ticket is **unblocked** when every blocker has closed. The **frontier** is the open, unblocked, unclaimed children: the edge of the known.
- Record answers on resolution; never pre-write them into the body. Link assets; never paste them.

## Ticket types

Every ticket is **HITL** (worked live with a human) or **AFK** (agent-driven). In HITL the agent never stands in for the human's side; a grilling that answers its own questions has broken this.

- **Research** (AFK) — surface a fact a decision waits on, from docs, APIs or knowledge bases outside the working directory. Resolve via `orc:research` as a background subagent.
- **Prototype** (HITL) — raise the fidelity of the discussion with a cheap concrete artifact to react to, via `orc:prototype`. Link the artifact as an asset.
- **Grilling** (HITL) — conversation; the default type. Always `orc:grilling` + `orc:domain-modeling`.
- **Task** (HITL or AFK) — manual work that must happen before a decision is possible: sign up for the service, provision access, move the data so its shape is visible. The one type that *does* rather than decides; it earns its place by unblocking a decision, not by delivering the destination. AFK where the agent can drive; otherwise hand the human a precise checklist. The answer records what happened and the facts later tickets depend on.

## Fog of war

The map is *deliberately* incomplete: never chart what you cannot yet see. **Not yet specified** holds the dim view: decisions you can tell are coming but cannot pin down, because they hang on open questions. Resolving a ticket clears fog; what is now specifiable graduates into fresh tickets.

The test is whether you can state the question precisely **now**, not whether you can answer it:

- Sharp question → ticket, even if blocked.
- Fuzzy → fog, uncut. One patch can graduate into several tickets, or none.

## Out of scope

The destination fixes the scope. Work beyond it is not fog and never graduates. When an existing ticket turns out to sit past the destination, **close it** and leave one line in **Out of scope**: gist, why, link to the closed ticket. It stays out of Decisions-so-far, which records only the route walked.
