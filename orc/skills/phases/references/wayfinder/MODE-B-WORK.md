<!-- orc:wayfinder/B -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Mode B — Work through the map

Invoked with `work <map ref> [ticket ref]`. Requires orc:wayfinder/MAP. Without a ticket ref, *you* pick the next decision.

> **⚠️ Caution**
>
> Other sessions can work the tracker concurrently. The claim in step 3 is what makes them skip this ticket.

> **🛑 Tracker writes**
>
> Steps 8–15 write to the tracker. The preview in step 7 precedes them.

## Load the map

1. Load the map at low resolution, not every ticket body.

## Choose and claim

2. Pick the named ticket, else the first frontier ticket in map order.
3. Claim the ticket by assigning it, before any work.

## Resolve

4. Read the ticket's `wayfinder:<type>` label; the body never states the type.
5. Resolve the ticket as that type (orc:wayfinder/MAP, Ticket types).
6. Zoom as needed: fetch related or closed ticket bodies on demand.

NOTE: invoke the skills the map's **Notes** name. Default to `orc:grilling` + `orc:domain-modeling`.

## Record

7. Preview the resolution comment and the map edit; ask before posting.
8. Post the answer as a resolution comment.
9. Close the ticket.
10. Append a gist plus link to the map's Decisions-so-far.

## Advance the frontier

11. Create the newly surfaced tickets: create, then wire.
12. Graduate fog the answer made specifiable into fresh tickets.
13. Clear each graduated patch from Not-yet-specified so it lives only as its ticket.
14. Rule mis-scoped tickets out of scope (orc:wayfinder/MAP, Out of scope).
15. Update or delete tickets the decision invalidated.

## Stop

16. Stop: one decision per session.
17. Close with `**➡️ Next**`: the new frontier, one line.
