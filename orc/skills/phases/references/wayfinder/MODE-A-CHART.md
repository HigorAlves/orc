<!-- orc:wayfinder/A -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Mode A — Chart the map

Invoked with `chart <loose idea>`. Requires orc:wayfinder/MAP.

> **🛑 Tracker writes**
>
> Steps 7–10 create the map and tickets on the tracker. The preview gate in steps 5–6 precedes them.

## Name the destination

1. Run `orc:grilling` + `orc:domain-modeling` to pin down the destination.

NOTE: the destination fixes the scope, so settle it first.

## Map the frontier

2. Grill again, breadth-first, fanning out across the whole space.
3. Surface the open decisions and the first takeable steps.
4. If this surfaces no fog, print the no-map gate and ask (options below).

No-map gate: the way is already clear and the journey fits one session. Print the headline per `orc:callouts`, then `AskUserQuestion`.

```markdown
> **⛔ Gate — no map needed**
```

Options: hand off to `/orc:plan`; slice via `orc:to-issues`; chart anyway.

## Preview

5. Print `**📋 Preview — map + tickets**` with the payload below.
6. Ask with `AskUserQuestion` to confirm before creating anything on the tracker.

Preview payload: the map body; every ticket title, type and question; the blocking edges.

## Create

7. Create the map per the tracker doc's wayfinding operations.
8. Create the specifiable tickets as children of the map.
9. Wire the blocking edges in a second pass, with real ids.
10. Write the cross-references in that same pass, with real ids.
11. Leave everything not yet specifiable in the fog section.

NOTE: items need ids before they can reference each other, hence the second pass. A placeholder `#<n>` auto-links to an unrelated issue.

## Fire the research subagents

12. For each research ticket, dispatch `orc:research` in the background.
13. Capture findings on a throwaway `research/<name>` branch linked from the ticket.
14. Push the branch.

NOTE: research tickets resolve in parallel. Open no PR for the research branch; nothing ever merges it.

## Stop

15. Stop. Charting is one session's work; it hand-resolves nothing.
