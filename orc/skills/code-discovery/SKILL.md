---
name: code-discovery
description: Use when discovering or navigating a codebase before planning, implementing, debugging, or refactoring — prefer a Graphify code-graph query over broad Glob/Grep/Read to cut token cost, with automatic fallback to grep when Graphify is absent.
---

# Code Discovery

## Overview

"Discovery" is the work of finding and understanding the code relevant to a task before you change it — the single largest, easily-wasted token cost in a session. Reading whole files to answer "where is X? what calls Y? how does Z flow?" is expensive. When [Graphify](https://github.com/Graphify-Labs/graphify) is available, a pre-built code graph answers those questions by traversal and hands you back the exact `source_location`s to read — so you `Read` a handful of precise spans instead of grepping the tree.

This skill is the **single source of truth** for that routing. It is intentionally loose-coupled and version-tolerant: Graphify is optional and pre-1.0, so every step is guarded and **falls back to plain Glob/Grep/Read** when Graphify is missing, unhealthy, or the graph is empty. Discovery must never hard-block on it.

Graphify ships its own `/graphify` skill (registered by `graphify install`). This skill does **not** reimplement graph building or querying — it decides *when* to reach for Graphify and defers the "how" to Graphify's CLI / skill.

## The protocol

### 1. Detect

- Binary on PATH? `command -v graphify` (equivalently `graphify --version`).
- Graph already built? `graphify-out/graph.json` exists at the repo root.

If the binary is absent → **skip to step 4 (fallback)**. Do not prompt the user to install it; the SessionStart tool-check already surfaces it as a recommended tool.

### 2. Build once if missing (code-only, no API key)

If `graphify` is installed but `graphify-out/graph.json` does not exist, build a code-only graph. This is pure local tree-sitter AST — **no LLM, no API key, seconds** on a typical repo:

```bash
graphify extract . --code-only
```

- In interactive commands (`/orc:start`, `/orc:plan`), mention it's happening ("Building a code graph for cheaper discovery…").
- In a dispatched agent, just build it — it is cheap and deterministic.
- Never pass a provider key and never run a semantic (non-`--code-only`) build for discovery. Code discovery is always key-free.
- If the build fails for any reason, **fall back to step 4** — do not retry in a loop or block the task.

### 3. Query-first

Answer structural questions against the graph instead of grepping the tree. Prefer, in order of specificity:

```bash
graphify query "where is auth wired to the database?" --budget 1500   # BFS/DFS traversal; --budget caps answer tokens
graphify explain "RateLimiter"                                        # what one symbol is and connects to
graphify path "UserService" "DatabasePool"                            # shortest path between two concepts
```

(Or invoke the `/graphify` skill, which wraps the same commands.) Then:

- **Cite `source_location`** from the results and `Read` only those precise files/spans — not whole directories.
- Use the graph's own vocabulary; if a query returns noise, rephrase against the node/community names the report surfaced rather than falling straight back to grep.

### 4. Fallback (Graphify absent, build failed, or empty graph)

Use today's discovery path unchanged: `Glob` for candidate files, `Grep` for symbols/usages, `Read` the immediate dependencies. This is the correct behavior whenever Graphify is not usable — it is a graceful degradation, not an error. Say nothing alarming; just proceed.

### 5. Keep the graph out of version control

Graphify writes to `graphify-out/`. Ensure it is ignored **without** creating a diff in the user's tracked `.gitignore` — use the repo-local exclude file:

```bash
grep -qxF 'graphify-out/' .git/info/exclude 2>/dev/null || echo 'graphify-out/' >> .git/info/exclude
```

(In a worktree, `.git` is a file pointing at the real gitdir; `git rev-parse --git-path info/exclude` resolves the correct path if you need to be exact.)

## Honesty rules

- Never claim you "used the code graph" if you fell back to grep — and vice-versa. State which path you took only if it matters to the answer.
- Never treat a Graphify answer as ground truth without reading the cited source. The graph points you at code; the code is the source of truth.
- If Graphify is installed but the graph looks stale (you touched files it doesn't know about), prefer `graphify update .` or fall back to grep for the changed area rather than trusting stale nodes.
