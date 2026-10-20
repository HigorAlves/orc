---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable tracker issues using tracer-bullet vertical slices
when_to_use: Use when converting a plan into issues or implementation tickets.
license: MIT
metadata:
  author: Matt Pocock
  source: Derived from https://github.com/mattpocock/skills (audit pin 5beb35b; techniques re-merged from upstream @ 5beb35b)
---

# To Issues

Break a plan, spec, or conversation into a set of independently-grabbable **issues** — tracer-bullet vertical slices, each declaring the issues that **block** it.

The issue tracker and triage label vocabulary come from the tracker layer — if absent, run `/orc:setup`.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** issues.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring comes first

</vertical-slice-rules>

Slices may be **HITL** or **AFK**. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

Give each issue its **blocking edges** — the other issues that must complete before it can start. An issue with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so no vertical slice can land green. Sequence it as **expand–contract** per [WIDE-REFACTORS.md](references/WIDE-REFACTORS.md).

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
- Do any issues need merging or splitting further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Publish the issues to the configured tracker

Publish the approved issues. **How** depends on the tracker `/orc:setup` configured — the issues are the same either way, only the shape of the blocking edges changes:

- **Local files** → write one file per issue under `.orc/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-issue file template in [TEMPLATES.md](references/TEMPLATES.md) — one issue per file, never a single combined file.
- **A real issue tracker (GitHub, Jira, Linear, …)** → publish one issue per slice in dependency order (blockers first) so each issue's blocking edges can reference real identifiers. Use the platform's native blocking relationship where it has one; otherwise set each issue's "Blocked by" to the blocking issues. If the source was an existing issue, make each slice its sub-issue (the tracker doc's operation). Apply the `needs-triage` triage label so each issue enters the normal triage flow.

Work the **frontier**: any issue whose blockers are all done. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.

Both templates — the per-issue local file and the tracker issue body — are in [TEMPLATES.md](references/TEMPLATES.md); read it before publishing.

In either form, avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Jira hierarchy variant

When the tracker is Jira and the output is the structured Epic→Story→Task hierarchy (micro-PRD epic, templated children, concurrency-sliced tasks) rather than flat issues, hand off to `/orc:jira-breakdown` — it enforces the `orc:jira-hierarchy` contract end-to-end.
