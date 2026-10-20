<!-- orc:plan/DISCOVERY -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 1b — Prime code discovery (optional, non-blocking)

1. Follow `orc:code-discovery`.
2. If `graphify` is not installed, skip silently.
3. If `graphify-out/graph.json` is missing, run `graphify extract . --code-only`.
4. If `graph.json`'s `built_at_commit` differs from the current branch, run `graphify update .`.
5. Add `graphify-out/` to `.git/info/exclude`.
6. In workspace mode, prime one graph per target repo.
7. If the build fails, skip silently.

NOTE: the extract is local AST, no key, seconds. A fresh graph lets `orc:plan/P2` (`orc:writing-plans`) and any dispatched `orc-prd-analyzer` map file touchpoints and blast radius by query instead of grepping the tree. Without it, planning falls back to Glob and Grep, unaffected.
