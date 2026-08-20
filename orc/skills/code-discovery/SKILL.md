---
name: code-discovery
description: Use when discovering or navigating a codebase before planning, implementing, debugging, or refactoring — prefer a Graphify code-graph query over broad Glob/Grep/Read to cut token cost, with automatic fallback to grep when Graphify is absent, stale, or unhealthy.
---

# Code Discovery

Discovery — finding the code relevant to a task before changing it — is the largest easily-wasted token cost in a session. When [Graphify](https://github.com/Graphify-Labs/graphify) is available, query the pre-built code graph and `Read` only the cited `source_location`s instead of grepping the tree. Graphify is optional and pre-1.0: every step below is guarded and **falls back to plain Glob/Grep/Read** — discovery never hard-blocks on it.

## The protocol

1. **Detect + health-check.** `command -v graphify`; graph exists at `graphify-out/graph.json`; graph fresh (`built_at_commit` in graph.json == `git rev-parse HEAD`, or `graphify check-update .` is clean). Binary absent → step 5; never prompt to install (SessionStart tool-check already surfaces it).
2. **Build/refresh when missing or stale** — pure local AST, no API key, seconds: `graphify extract . --code-only` (missing) or `graphify update .` (stale). Mention it in interactive commands; just do it in dispatched agents. Build fails → step 5, no retry loop. Never run a semantic (non-`--code-only`) build for discovery.
3. **Load lessons once, if present.** `Read` `graphify-out/reflections/LESSONS.md` before the first query (bounded ≈1500 tokens); prefer its listed nodes, skip its dead ends. Lessons are hints, not ground truth. Absent → skip silently. You only *consume* lessons — the orchestrating command records outcomes at a verified gate, so surface which graph nodes you relied on.
4. **Query-first.** Answer structural questions by traversal, most-specific verb first:
   ```bash
   graphify query "where is auth wired to the database?" --budget 1500
   graphify explain "RateLimiter"          # one symbol and its connections
   graphify path "UserService" "DatabasePool"
   graphify affected "processRefund" --depth 2   # reverse blast radius — leads, not verdicts
   ```
   Then `Read` only the cited `source_location`s. Noisy answer → raise `--budget` or rephrase before abandoning the graph. Verify every cited caller by reading it — never claim "all callers handled" from graph output alone, least of all from a stale graph. A verb that errors or emits unparseable output → treat the graph as unavailable for that question and fall back (probe new verbs with `graphify <verb> --help`).
5. **Fallback** (absent / stale / failed / empty): `Glob` candidates, `Grep` symbols, `Read` immediate dependencies. Graceful degradation, not an error — say nothing alarming.
6. **Keep the graph out of version control** (repo-local exclude, no tracked-file diff):
   ```bash
   grep -qxF 'graphify-out/' .git/info/exclude 2>/dev/null || echo 'graphify-out/' >> .git/info/exclude
   ```

## Honesty rules

- Never claim you used the graph when you grepped, or vice-versa.
- The graph points; the code decides — read cited sources before asserting.
- Freshness is load-bearing for any completeness claim: stale graph → refresh or grep the changed area.

Deep detail — verb catalog with caveats, `--budget` discipline, LESSONS.md mechanics, worktree exclude paths: [GRAPHIFY.md](references/GRAPHIFY.md) (interactive sessions only; this body is self-sufficient for preloaded agents).
