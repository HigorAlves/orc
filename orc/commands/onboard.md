---
description: "Document an existing codebase for agents and humans — overview, source-tree map, and per-area deep dives written into the repo knowledge layer. Resumable. Modes: initial (default) | rescan | deep-dive <area>."
argument-hint: "[initial|rescan|deep-dive] [<area>] [--commit] [--local]"
arguments: [mode]
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(orc-workspace-detect:*)
  - Bash(graphify:*)
  - Bash(git log:*)
  - Bash(git status:*)
  - Bash(date:*)
  - Bash(jq:*)
  - Bash(find:*)
  - Bash(wc:*)
---

# /orc:onboard

Turn an unfamiliar repo into written knowledge — for the next agent and the next teammate. `/orc:scaffold` is the greenfield surface; this is the **brownfield** one.

The expensive half of this is discovery, and orc already has it: `orc:code-discovery` gives a real code graph. This command is the prose layer over that graph.

## When NOT to use

- **Agent directives** ("never edit this generated file") → `/orc:context`. Short, binding, loaded on every task.
- **A decision record** → `/orc:adr`.
- **Answering one question about the code** → just query the graph per `orc:code-discovery`. Onboarding is for orientation, not lookup.

## Arguments

- `initial` (default) — first pass. Refuses if knowledge files already exist (routes to `rescan`).
- `rescan` — regenerate against the current tree, preserving human edits.
- `deep-dive <area>` — one exhaustive document for a module, package, or feature.
- `--commit` / `--local` — force the committed or local knowledge location, overriding the setup answer.

## Output layout

Written into the knowledge dir resolved in Phase 0 — `<K>` below, always `<context-layer root>/knowledge/`:

| File | Contents |
|---|---|
| `<K>/project-overview.md` | Stack, architecture shape, entry points, how to run it, how to test it |
| `<K>/source-tree.md` | Annotated folder map — every top-level dir gets a purpose line |
| `<K>/deep-dive-<area>.md` | One per area: responsibilities, data flow, key types, extension points |
| `<K>/index.md` | Navigation hub linking all of the above |
| `<K>/scan-report.json` | Machine state — areas found, areas documented, tree sha. Resumability lives here |

Shape follows `orc:documentation-writing` (Diátaxis): the overview is **explanation**, the source tree is **reference**, deep dives are **explanation** with reference tables. No tutorials — this is orientation, not a course.

## Phase 0 — Detect context + resolve the knowledge dir

!`orc-workspace-detect --banner`

Per `orc:tracker-config` and `docs/agents/domain.md`'s `## Project context` section — the same opt-in answer that places `project-context.md`:

| Location | `<K>` |
|---|---|
| committed | `docs/agents/knowledge/` |
| local (default) | `${ORC_STATE_DIR}/knowledge/` |

Like `project-context.md`, `${ORC_STATE_DIR}/knowledge/` is **per-repo, not per-branch** — it sits beside `orc.json` and `/orc:cleanup` never removes it.

In workspace mode, run once per target repo. A knowledge dir is repo-scoped.

Register state — this is a long, interruptible scan:

```
orc-state init --command onboard --total-phases 5
```

## Phase 1 — Prime the graph

Follow `orc:code-discovery`. Build (`graphify extract . --code-only`) or refresh (`graphify update .`) the graph. Add `graphify-out/` to `.git/info/exclude`.

Graphify absent or unhealthy → **say so in one line and continue**. The scan degrades to Glob/Grep and takes longer; it does not fail. Record `"graph": false` in `scan-report.json` so the quality of what follows is legible.

Checkpoint: `orc-state phase set 1` + `orc-state digest write -`.

## Phase 2 — Scan and propose the area list

1. **Detect the project type** — manifests, lockfiles, framework config, CI workflows. Monorepo signals (`pnpm-workspace.yaml`, `turbo.json`, `go.work`, populated `packages/*`) mean N sub-projects, each an area candidate.
2. **Map the tree** — top-level dirs, entry points (`main`, `bin`, `cmd/`, route roots), config, generated dirs.
3. **Derive areas** — a candidate is a coherent unit with its own responsibility: a package, a bounded context, a service, a major feature dir. Rank by centrality (graph fan-in when available, else file count × churn from `git log`).
4. **Gate.** Print `> **⛔ Gate — onboarding scope**` (one line: project type, N areas found), then `AskUserQuestion`:
   - **Overview + tree only** — skip deep dives (fastest; good for a first look)
   - **Overview + tree + top N deep dives** — recommended; N defaults to 5
   - **Pick areas** — multi-select follow-up
   - **Cancel**

Write the full candidate list to `scan-report.json` regardless of what is selected — a later `deep-dive` run reads it instead of rescanning.

> **⚠️ Caution**
>
> When the selection caps deep dives at N, `index.md` must list the undocumented areas under `## Not yet documented`. A knowledge dir that silently omits half the repo reads as complete when it isn't.

Checkpoint: phase 2.

## Phase 3 — Write overview + source tree

`project-overview.md` — derived, never guessed. Where the README claims something the code contradicts, document the code and note the drift.

`source-tree.md` — every top-level dir and every significant second-level dir gets one purpose line. Generated and vendored dirs are marked as such. Depth beyond that is a deep dive's job.

Checkpoint: phase 3.

## Phase 4 — Deep dives

One dispatched agent per selected area, in parallel per `orc:dispatching-parallel-agents` — each brief is self-contained (area path, graph handle, output path), never the session history. Each returns one `deep-dive-<area>.md`:

- Responsibility — what this area owns, in two sentences
- Entry points — how control reaches it
- Data flow — what comes in, what goes out, what it persists
- Key types / interfaces — the handful worth knowing, with `file:line`
- Extension points — where new work is meant to attach
- Gotchas — surprising coupling, load-bearing ordering, sharp edges

Persist each file as it returns. A killed run resumes from `scan-report.json` and re-dispatches only the areas still missing.

Checkpoint: phase 4 after each area completes — this is the phase most likely to be interrupted.

## Phase 5 — Index + hand-off

Write `index.md`: one line per document, plus `## Not yet documented` when the scope gate capped coverage.

Then offer the natural follow-on via `AskUserQuestion`:
- **Run `/orc:context generate`** — recommended. The scan just surfaced exactly the conventions and landmines that belong in the directive layer, and the graph is warm.
- **Deep-dive another area**
- **Done**

Mark the session `orc-state phase set done`.

## Rescan

`rescan` re-runs Phases 1–5 against the current tree with two rules:

- **Human edits survive.** Any line marked `<!-- human -->`, and everything under a `## Notes` heading, is copied through verbatim.
- **The diff is what gates**, not the whole regenerated set. Per-file: accept / skip / show.

Areas that disappeared from the tree are surfaced for deletion, never deleted silently.

## Output

- `<K>/` populated as above.
- A one-line summary: `<n> areas found, <n> documented, <n> deferred — <K>/index.md`.
- With `--commit`, files are left **staged but uncommitted**.
