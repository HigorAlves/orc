<!-- orc:triage/OUT-OF-SCOPE -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Out-of-scope knowledge base

`docs/agents/out-of-scope.md` is the persistent record of rejected enhancements: institutional memory (why) plus deduplication (surface the prior decision instead of re-litigating). One `##` section per concept, titled so a skimmer knows what was rejected without reading, written like a short design note.

## Entry template

```markdown
## Dark Mode

This project does not support dark mode or user-facing theming.

**Why out of scope:** the rendering pipeline assumes a single palette resolved at
build time; theming is a downstream-consumer concern. Durable reasons only —
"too busy right now" is a deferral, not a rejection.

**Prior requests:** #42, #87
```

## Rules

1. Check it during `orc:triage/P2` step 6 of every triage.
2. On a match, ask the maintainer: confirm, reconsider, or unrelated (choices below).
3. Write it only for rejected enhancements; never bugs, never already-implemented requests.
4. When the maintainer changes their mind, delete the entry; old closed items stay closed as history.

Match choices:

- Confirm — append the new item to Prior requests, then close.
- Reconsider — update or delete the entry, then triage normally.
- Unrelated — triage normally.
