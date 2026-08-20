# Graphify deep reference (code-discovery)

Elaboration for the `orc:code-discovery` protocol. The SKILL.md body is operationally complete; read this only when you need the reasoning or the full verb surface.

## Verb catalog

```bash
graphify query "<natural-language question>" --budget 1500   # BFS/DFS traversal; --budget caps answer tokens
graphify explain "<Symbol>"                                  # what one symbol is and connects to
graphify path "<A>" "<B>"                                    # shortest path between two concepts
graphify affected "<Symbol>" --depth 2                       # reverse blast-radius: who calls / what breaks
graphify god-nodes --json --top 10                           # architectural hubs (degree centrality)
graphify check-update .                                      # staleness probe
graphify extract . --code-only                               # build (local tree-sitter AST; no LLM, no key)
graphify update .                                            # incremental refresh (AST-only)
```

Graphify also ships its own `/graphify` skill (registered by `graphify install`) wrapping the same commands — `orc:code-discovery` decides *when* to reach for the graph and defers the "how" to Graphify's CLI/skill; it never reimplements graph building or querying.

## `affected` / `god-nodes` caveats

- Output shape: `affected` prints each impacted node as `- <symbol> [<relation>] <file>:<line>` — read the cited spans.
- They are **leads, not verdicts**: candidate callers and load-bearing hubs, far faster than grep — but they do not license a completeness claim. `affected` does not expose per-edge confidence, and some edges are `INFERRED`; verify each cited caller by reading it before asserting anything about it.
- Never state "all callers handled / nothing else affected" from graph output alone — least of all from a graph whose `built_at_commit` ≠ your tree. A stale graph can omit a new caller or list a deleted one; a confident-but-wrong answer is worse than none.

## `--budget` discipline

Keep query answers capped (`--budget 1500` default). If a query returns noise, raise the budget or rephrase against the graph's own node/community names before falling back to grep — don't reflexively abandon the graph.

## LESSONS.md mechanics

`graphify-out/reflections/LESSONS.md` is a deterministic digest of what past graph-guided work in this repo found useful — preferred source nodes, recorded dead ends, corrections. Aggregated with a 30-day half-life and a 2-result corroboration floor, so one-off noise never becomes a lesson.

- Bounded ≈1500 tokens by construction — a full read never costs more than one extra `--budget 1500` query. If ever larger, read only its "Preferred / Dead ends / Corrections" sections.
- A discovering agent only **consumes** lessons — never records them mid-query. Outcomes are recorded by the orchestrating command at a *verified* gate (e.g. `/orc:debug` after the suite passes), not from a guess. Surface which nodes you relied on so the caller can record the outcome.

## Version-tolerance rationale

Graphify is pre-1.0 and its CLI surface moves. Probe an unfamiliar verb with `graphify <verb> --help`; a command that errors, exits non-zero, or returns unparseable output means the graph is unavailable *for that question* — degrade to a slower answer, never to a wrong one. Keeping all graphify calls inside the `orc:code-discovery` protocol means a breaking change is fixed in one place.

## Worktree note for the exclude file

In a git worktree, `.git` is a file pointing at the real gitdir; `git rev-parse --git-path info/exclude` resolves the correct exclude path when the plain `.git/info/exclude` append doesn't apply.
