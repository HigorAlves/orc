# Domain docs

How tracker-aware skills consume this repo's domain documentation when exploring the codebase. Layout and maintenance discipline: `orc:domain-modeling`.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root — orc's own vocabulary: gates, slices, the ledger, trains, the size budget, investigator and executor roles.
- **`docs/adr/`** — the decisions behind the layout: independent PRs, the mod over bash hooks, dual-tag releases, caveman defaults, punctuation, `AskUserQuestion` gates.
- **`docs/architecture.md`** — the component map and why the four-way split exists.

## Layout for this repo

Single-context: `GLOSSARY.md` + `docs/adr/` at the root.

## Use the glossary's vocabulary

When output names an orc concept (issue title, hypothesis, test name), use the term as `GLOSSARY.md` defines it — don't drift to synonyms the glossary avoids. A missing concept is a signal: either reconsider the invented language, or note the gap for `orc:domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR 0001 (independent PRs) — but worth reopening because…_
