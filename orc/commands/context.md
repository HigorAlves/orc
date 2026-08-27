---
description: "Generate, refresh, read, or extend the repo's project-context.md — the lean agent-directive layer every executor agent loads before touching code. Verbs: generate (default) | show | refresh | add-rule."
argument-hint: "[generate|show|refresh|add-rule] [\"<rule text>\"] [--section <name>] [--commit] [--local]"
arguments: [verb]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(orc-state:*)
  - Bash(orc-workspace-detect:*)
  - Bash(git log:*)
  - Bash(git status:*)
  - Bash(graphify:*)
  - Bash(date:*)
  - Bash(shasum:*)
  - Bash(wc:*)
  - Bash(jq:*)
---

# /orc:context

Maintain `project-context.md` — the durable conventions layer that survives the branch. `.orc/` state dies at cleanup; this does not.

Contract, section spine, size cap, and the per-line rubric live in `orc:project-context`. **Invoke that skill first** — this command is the surface, the skill is the law.

## When NOT to use

- **Architecture prose, source-tree maps, component deep-dives** → `/orc:onboard`. Those are for humans and for orientation; this file is directives for agents.
- **Domain vocabulary** → `CONTEXT.md` via `orc:domain-modeling`. A glossary is not a directive.
- **A decision and its trade-offs** → `/orc:adr`. Context may *point at* an ADR; it never replaces one.

## Arguments

- `generate` (default) — derive a fresh context file from the codebase. Gates before writing.
- `show` — print the resolved path, the file, and its size against the cap. Read-only.
- `refresh` — diff-aware regeneration that preserves human-marked regions.
- `add-rule "<text>"` — append one rule. The fast path `orc:retrospective` calls.
- `--section <name>` — with `add-rule`: target section (default inferred from the rule's shape).
- `--commit` / `--local` — force the committed (`docs/agents/`) or local (`.orc/`) location, overriding the setup answer.

## Phase 0 — Resolve the path

!`orc-workspace-detect --banner`

Run the `orc:tracker-config` read protocol and read `docs/agents/domain.md`'s `## Project context` section:

| Found | Path |
|---|---|
| `location: committed` | `docs/agents/project-context.md` |
| `location: local`, or no `## Project context` section | `${ORC_STATE_DIR}/project-context.md` |

`--commit` / `--local` override. In workspace mode, resolve and operate **per target repo** — a context file is repo-scoped, never workspace-scoped.

> **⚠️ Caution**
>
> `.orc/project-context.md` sits beside `orc.json`, NOT inside `<branch>/files/`. It is per-repo and outlives every branch. `/orc:cleanup` must never remove it.

This file is deliberately **outside** the session-state contract — it is not registered, not checkpointed, and not read by resume. See `orc:state-protocol` for what `.orc/<sessionId>/files/` owns; everything here sits beside it, not in it.

## Phase 1 — `show`

Print the resolved path, then the file, then:

```
project-context.md — <n> lines / <n> KB  (cap: 150 lines / 6 KB)  ✓
stack_fingerprint: <sha>  (current: <sha>)  ✓ fresh | ⚠ drifted — refresh due
```

Absent file → say so in one line and offer `generate`. **Never treat absence as an error.** Exit.

## Phase 2 — `generate`

1. **Invoke `orc:project-context`.** Follow its generation protocol exactly.
2. **Prime discovery** per `orc:code-discovery` — build or refresh the graph if `graphify` is present; fall back to Glob/Grep silently when it is not.
3. **Derive** the six sections from evidence, in this order of authority: CI gate scripts > `Makefile`/`package.json` scripts > the real source tree > `CONTRIBUTING.md` > README. Where the README and the code disagree, **the code wins** and the disagreement itself is often a landmine worth a line.
4. **Apply the rubric.** Every candidate line passes all four tests in `orc:project-context`'s `references/FORMAT.md` or it is cut. Cutting is the default.
5. **Compute** `stack_fingerprint`: `shasum` over the sorted, concatenated dependency manifests (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, lockfile majors). Short to 8 chars.
6. **Gate.** Print the `> **⛔ Gate — project context**` callout (one line: section count, line count vs cap, resolved path), then the full draft, then `AskUserQuestion`:
   - **Write it** — accept as drafted.
   - **Trim first** — name the sections to cut, redraft, re-gate.
   - **Cancel.**

   This gate asks at **every** autopilot level. The file directs every future agent in the repo; a wrong line compounds silently across branches. It is not a mechanical confirm.
7. **Write**, then print the post-write size line from Phase 1.

If the target already exists, `generate` refuses and routes to `refresh` — regenerating from scratch would discard human edits.

## Phase 3 — `refresh`

1. Read the existing file. Extract **preserved regions**: every line carrying `<!-- human -->`, and everything under `## Notes`.
2. Re-derive per Phase 2 steps 2–5.
3. **Diff** derived against existing, section by section. Preserved regions are copied through untouched and excluded from the diff.
4. Gate on **the diff**, not the whole file — `AskUserQuestion`: accept all / pick hunks / cancel.
5. Write, bump `generated` and `stack_fingerprint`, print the size line.

If the diff is empty, say `project-context.md is current — no drift.` and exit without writing.

## Phase 4 — `add-rule`

The append path. Deliberately cheap: one rule, one confirm, no regeneration.

1. **Rubric check.** Run the incoming rule against all four tests. Failing rules are refused with the failing test named — this is the valve that keeps the retro loop from bloating the file.
2. **Dedupe.** If an existing line already covers it, offer to *replace* that line rather than add a second one.
3. **Section.** Use `--section`, else infer: a prohibition → Patterns to avoid; a build/gate requirement → Critical rules; a test fact → Testing conventions; a surprise → Known landmines.
4. **Cap check.** If appending would breach 150 lines, **do not append silently.** Surface the breach and `AskUserQuestion`: cut a stale rule now (list candidates — rules whose `generated` predates the last two refreshes) / append anyway and flag for the next refresh / cancel.
5. Append, bump `generated`, print the one-line size status.

Called by `orc:retrospective` with `--section` pre-set. Under autopilot the rubric check and dedupe still run; only the final confirm auto-advances at `guided`+.

## Output

- The resolved `project-context.md`, written or unchanged.
- One size line, always — `<n> lines / <n> KB (cap: 150/6 KB)`.
- On `--commit` runs the file is left **staged but uncommitted**; committing docs is the user's call, not the command's.
