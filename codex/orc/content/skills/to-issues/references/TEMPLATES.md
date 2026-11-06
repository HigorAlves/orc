# Issue templates

The per-issue file template (local tracker) and the issue-body template (real tracker). Read from step 5 of [SKILL.md](../SKILL.md) when publishing.

<local-issue-template>

# <NN> — <Issue title>

**What to build:** the end-to-end behaviour this issue makes work, from the user's perspective — not a layer-by-layer implementation list.

**Type:** HITL | AFK

**Blocked by:** the numbers/titles of the issues that gate this one, or "None — can start immediately".

**Status:** needs-triage

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

</local-issue-template>

<issue-template>

## Parent

A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

## What to build

The end-to-end behaviour this issue makes work, from the user's perspective — not layer-by-layer implementation. Note whether the slice is HITL or AFK.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking issue, or "None — can start immediately". Omit this section when blockers were set as native edges.

</issue-template>
