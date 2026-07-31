---
name: code-discovery
description: Use when discovering or navigating a codebase before planning, implementing, debugging, or refactoring — prefer a Graphify code-graph query over broad Glob/Grep/Read to cut token cost, with automatic fallback to grep when Graphify is absent, stale, or unhealthy.
---

# Code Discovery

## Overview

"Discovery" is the work of finding and understanding the code relevant to a task before you change it — the single largest, easily-wasted token cost in a session. Reading whole files to answer "where is X? what calls Y? how does Z flow?" is expensive. When [Graphify](https://github.com/Graphify-Labs/graphify) is available, a pre-built code graph answers those questions by traversal and hands you back the exact `source_location`s to read — so you `Read` a handful of precise spans instead of grepping the tree.

This skill is the **single source of truth** for that routing. It is intentionally loose-coupled and version-tolerant: Graphify is optional and pre-1.0, so every step is guarded and **falls back to plain Glob/Grep/Read** when Graphify is missing, unhealthy, stale, or the graph is empty. Discovery must never hard-block on it.

Graphify ships its own `/graphify` skill (registered by `graphify install`). This skill does **not** reimplement graph building or querying — it decides *when* to reach for Graphify and defers the "how" to Graphify's CLI / skill.

## The protocol

### 1. Detect and health-check

- **Binary on PATH?** `command -v graphify` (equivalently `graphify --version`).
- **Graph already built?** `graphify-out/graph.json` exists at the repo root.
- **Graph fresh?** A graph is only trustworthy for the tree it was built from. `graph.json` records `built_at_commit`; compare it to the SHA of the tree your answer is about (`git rev-parse HEAD` for the working tree). `graphify check-update .` also flags pending staleness. If they diverge, the graph is **stale** — refresh it (step 2) or narrow to grep for the changed area (step 5).

If the binary is absent → **skip to step 5 (fallback)**. Do not prompt the user to install it; the SessionStart tool-check already surfaces it as a recommended tool.

### 2. Build or refresh if missing/stale (code-only, no API key)

If `graphify` is installed but `graphify-out/graph.json` does not exist, build a code-only graph. This is pure local tree-sitter AST — **no LLM, no API key, seconds** on a typical repo:

```bash
graphify extract . --code-only
```

If the graph exists but is **stale** (step 1: `built_at_commit` ≠ your tree's SHA, or `check-update` flags it), refresh it incrementally — AST-only, still no key:

```bash
graphify update .
```

- In interactive commands (`/orc:start`, `/orc:plan`), mention it's happening ("Building/refreshing a code graph for cheaper discovery…").
- In a dispatched agent, just build/refresh it — it is cheap and deterministic.
- Never pass a provider key and never run a semantic (non-`--code-only`) build for discovery. Code discovery is always key-free.
- If the build/refresh fails for any reason, **fall back to step 5** — do not retry in a loop or block the task.

### 3. Load prior lessons (if present)

If `graphify-out/reflections/LESSONS.md` exists, `Read` it **once, before your first query**. It is a deterministic digest of what past graph-guided work in this repo actually found useful — preferred source nodes, recorded dead ends, and corrections (aggregated with a 30-day half-life and a 2-result corroboration floor, so one-off noise never becomes a lesson). Use it to prefer the nodes it lists and skip the dead ends it names.

- **Bound the cost.** LESSONS is kept small (≈1500 tokens — no larger than a single `--budget 1500` query), so a full read never costs more than one extra query. If it is ever larger, read only its "Preferred / Dead ends / Corrections" sections.
- Lessons are **hints, not ground truth** — they point; the code still decides (see Honesty rules).
- Absent file → skip silently. **A discovering agent only *consumes* lessons — never records them mid-query.** Outcomes are recorded by the orchestrating command at a *verified* gate (e.g. `/orc:debug` after the suite passes), not from a guess. If you queried the graph, surface which nodes you relied on so the caller can record the outcome.

### 4. Query-first

Answer structural questions against the graph instead of grepping the tree. Prefer, in order of specificity:

```bash
graphify query "where is auth wired to the database?" --budget 1500   # BFS/DFS traversal; --budget caps answer tokens
graphify explain "RateLimiter"                                        # what one symbol is and connects to
graphify path "UserService" "DatabasePool"                            # shortest path between two concepts
graphify affected "processRefund" --depth 2                           # reverse blast-radius: who calls / what breaks if this changes
graphify god-nodes --json --top 10                                    # architectural hubs (degree centrality; JSON out)
```

(Or invoke the `/graphify` skill, which wraps the same commands.) Then:

- **Cite `source_location`** from the results and `Read` only those precise files/spans — not whole directories. `affected` prints each impacted node as `- <symbol> [<relation>] <file>:<line>` — read the cited spans.
- **`--budget` discipline.** Keep query answers capped (`--budget 1500` default). If a query returns noise, *raise the budget or rephrase against the graph's own node/community names* before falling back to grep — don't reflexively abandon the graph.
- **`affected` / `god-nodes` are leads, not verdicts.** They tell you *where to look* — candidate callers, load-bearing hubs — far faster than grep; they do **not** license a completeness claim. `affected` output does not expose per-edge confidence, and some edges are `INFERRED`, so verify each cited caller by reading it before asserting anything about it. Never state "all callers handled / nothing else affected" from graph output alone — least of all from a graph whose `built_at_commit` ≠ your tree.

### 5. Fallback (Graphify absent, build/refresh failed, stale, or empty graph)

Use today's discovery path unchanged: `Glob` for candidate files, `Grep` for symbols/usages, `Read` the immediate dependencies. This is the correct behavior whenever Graphify is not usable — it is a graceful degradation, not an error. Say nothing alarming; just proceed.

### 6. Keep the graph out of version control

Graphify writes to `graphify-out/`. Ensure it is ignored **without** creating a diff in the user's tracked `.gitignore` — use the repo-local exclude file:

```bash
grep -qxF 'graphify-out/' .git/info/exclude 2>/dev/null || echo 'graphify-out/' >> .git/info/exclude
```

(In a worktree, `.git` is a file pointing at the real gitdir; `git rev-parse --git-path info/exclude` resolves the correct path if you need to be exact.)

## Honesty rules

- Never claim you "used the code graph" if you fell back to grep — and vice-versa. State which path you took only if it matters to the answer.
- Never treat a Graphify answer as ground truth without reading the cited source. The graph points you at code; the code is the source of truth. Lessons (step 3) and `affected` / `god-nodes` leads (step 4) are hints — verify by reading before you assert.
- **Freshness is load-bearing for any completeness claim.** A stale graph (`built_at_commit` ≠ the reviewed tree) can omit a new caller or list a deleted one — a confident-but-wrong answer is worse than none. Refresh (`graphify update .`) or grep the changed area; never source a "handled every case" claim from a stale graph.
- **Probe before you trust a new verb.** Graphify is pre-1.0 and its CLI surface moves. If a command errors, exits non-zero, or returns output you can't parse, treat the graph as unavailable for that question and fall back to grep — degrade to a slower answer, never to a wrong one. Keep all graphify calls inside this protocol so a breaking change is fixed in one place.
