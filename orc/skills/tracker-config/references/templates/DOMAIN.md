# Seed template — domain.md

### domain.md

````markdown
# Domain docs

How tracker-aware skills consume this repo's domain documentation when exploring the codebase. Layout and maintenance discipline: `orc:domain-modeling`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the ubiquitous-language glossary — or **`CONTEXT-MAP.md`** if it exists (multi-context: it points at one `CONTEXT.md` per context; read the ones relevant to the topic).
- **`docs/adr/`** — ADRs touching the area you're about to work in. Multi-context repos also carry `src/<context>/docs/adr/` for context-scoped decisions.

If any of these don't exist, **proceed silently** — don't flag their absence or suggest creating them; `orc:domain-modeling` creates them lazily when terms or decisions actually get resolved.

## Layout for this repo

[single-context: `CONTEXT.md` + `docs/adr/` at the root | multi-context: root `CONTEXT-MAP.md` + per-context `CONTEXT.md` files]

## Use the glossary's vocabulary

When output names a domain concept (issue title, hypothesis, test name), use the term as `CONTEXT.md` defines it — don't drift to synonyms the glossary avoids. A missing concept is a signal: either reconsider the invented language, or note the gap for `orc:domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
