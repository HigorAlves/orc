---
name: gates
description: The canonical AskUserQuestion conventions for every orc gate — class-tagged header chips, Recommended-first options, side-by-side `preview` for preview-then-confirm, multiSelect chunking, notes as the rewrite channel, and the --auto ladder. Use when about to render an orc gate.
---

# Gates

Every orc gate is ONE `AskUserQuestion` call shaped by these rules. The gate classes themselves (hard-outward / soft-inward / escalation-only) are defined in `orc:using-orc`; the 1–3 line context block before the call is the **⛔ Gate** callout from `orc:callouts`. Options never go inside the callout — the question widget renders them.

## 1. Header chip = gate class

The `header` chip (≤12 chars) tells the user what kind of decision this is. Hard-outward and escalation gates use a **closed vocabulary**, so the class is readable at a glance (and machine-readable for future UI):

| Class | Chips | Rule |
|---|---|---|
| Hard-outward | `Publish` (evidence / artifact upload) · `Post` (PR review, replies, comments) · `Tracker` (issue / Jira writes) | Always asks — no flag, policy, or settled decision skips it. Name the exact target (repo, PR #, ticket key) in the question. |
| Escalation-only | `Escalation` | Never asked proactively; stops the run at every policy level. |
| Soft-inward | Free, short noun: `Plan`, `Driver`, `PR size`, `Compose`, `Next step`, … | Never reuse an outward or escalation chip. |

## 2. Options

- 2–4 options. Never add an "Other" option — the widget always provides free text.
- Recommended option **first**, label suffixed `(Recommended)`. Exactly one, or none when there is no defensible default.
- Each `description` states the consequence ("pushes to origin", "posts 6 comments to #123"), not a restatement of the label.
- A destructive or outward option names its target in the label or description.

## 3. `preview` for preview-then-confirm

When the user approves a payload (PR body, review comments, upload manifest, slice table, stack split, Jira tree):

- Put the payload in the option's `preview` field (markdown, monospace) — single-select only. Alternatives render side by side: give each variant its own option + preview (e.g. caveman vs full PR body).
- The `📋 Preview` callout stays as a one-line headline; do not also print the full payload in a fence — one rendering.
- Payload over ~60 lines: write it to `${ORC_STATE_DIR}/<branch>/files/` and preview the head plus the path.
- No `AskUserQuestion` available (headless): fall back to the callout + fenced payload, then stop for a plain-text answer. Hard-outward gates still never auto-proceed.

## 4. Picking items: `multiSelect` chunks

To drop / keep items from a numbered list (replies, comments, slices):

- `multiSelect: true`, one question per chunk of **4 items** ("Drop which of comments 1–4?"), up to 4 questions in the same call (16 items max). Default = keep all.
- Never one question per item; never more than one extra round trip to apply edits.

## 5. Rewrites ride the notes

Edits to an item travel in the selection's **notes** annotation, one per line: `<n>: <new text>`. The free-text answer is accepted as a fallback in the same shape. Edited payloads re-render once in a final preview before anything outward happens.

## 6. Autopilot ladder (`--auto[=guided|full]`)

Commands that take `--auto` point here instead of restating it. The flag overrides the `interaction_policy` userConfig; resolution and the settled-decisions store live in `orc:state-protocol`.

- `manual` (default) — every soft-inward gate asks.
- `guided` — mechanical confirms auto-advance with a printed one-liner (`➡️ auto: <choice> — guided`); judgment calls still ask.
- `full` (bare `--auto`) — soft-inward gates resolve from settled decisions; the run stops only on escalation-only conditions.
- Hard-outward gates are unaffected at every level. Auto never picks an option that writes outward or overrides a budget (e.g. never "Open as one big PR").

## 7. Batching

One decision point = one `AskUserQuestion` call, up to 4 questions. Ask everything that's answerable now in that call; don't serialize questions the user could answer together.
