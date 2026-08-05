---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable tracker issues using tracer-bullet vertical slices. Use when converting a plan into issues or implementation tickets.
license: MIT
metadata:
  author: Matt Pocock
  source: Derived from https://github.com/mattpocock/skills (audit pin 2ffb184; techniques re-merged from upstream @ 2ffb184)
---

# To Issues

Break a plan, spec, or conversation into a set of independently-grabbable **issues** — tracer-bullet vertical slices, each declaring the issues that **block** it.

The issue tracker and triage label vocabulary should have been provided to you — run `/orc:setup` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** issues.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Slices may be **HITL** or **AFK**. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

Give each issue its **blocking edges** — the other issues that must complete before it can start. An issue with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own issue blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in an issue blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify issue — green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each issue, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other issues (if any) must complete first
- **What it delivers**: the end-to-end behaviour this issue makes work
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each issue only depend on issues that genuinely gate it?
- Should any issues be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Publish the issues to the configured tracker

Publish the approved issues. **How** depends on the tracker `/orc:setup` configured — the issues are the same either way, only the shape of the blocking edges changes:

- **Local files** → write one file per issue under `.orc/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-issue file template below — one issue per file, never a single combined file.
- **A real issue tracker (GitHub, Jira, Linear, …)** → publish one issue per slice in dependency order (blockers first) so each issue's blocking edges can reference real identifiers. Use the platform's native blocking / sub-issue relationship where it has one; otherwise set each issue's "Blocked by" to the blocking issues. Apply the `needs-triage` triage label so each issue enters the normal triage flow.

Work the **frontier**: any issue whose blockers are all done. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.

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

- A reference to each blocking issue, or "None — can start immediately".

</issue-template>

In either form, avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Jira hierarchy variant

When the tracker is Jira and the output should be the structured Epic→Story→Task hierarchy (micro-PRD epic, templated children, concurrency-sliced tasks) rather than flat issues, hand off to `/orc:jira-breakdown` — it enforces the `orc:jira-hierarchy` contract end-to-end.
