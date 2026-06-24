---
name: postgresql-optimization
description: 'Write or review PostgreSQL-specific SQL: JSONB, arrays, custom/range/geometric types, indexing, full-text search, window functions, extensions, and RLS. Use for PG-unique features and code review.'
---

# PostgreSQL Development & Review Assistant

Expert PostgreSQL guidance for ${selection} (or the entire project if no selection). Covers PostgreSQL-specific features, optimization patterns, and the review lens for PG code. This SKILL.md is a thin index — **Read the relevant `references/*.md` file when you need that detail.**

## When to use

Reach for this skill whenever you are writing, optimizing, or reviewing PostgreSQL-specific SQL and want to leverage what makes PostgreSQL special rather than treating it as a generic SQL database:

- Modeling or querying **JSONB**, **arrays**, or **custom/range/geometric types**.
- Designing **indexes** or diagnosing slow queries (EXPLAIN ANALYZE, `pg_stat_statements`).
- **Full-text search**, **window functions**, recursive **CTEs**.
- Choosing and using **extensions** (pg_trgm, pgcrypto, PostGIS, pgvector, TimescaleDB, …).
- **Reviewing** PG code for anti-patterns, schema-design smells, function/trigger issues, and security (RLS, privileges).

## How to work

1. Identify the topic, open the matching reference, apply its patterns to the selection.
2. Prefer PostgreSQL-native operators/types over generic SQL equivalents.
3. Back every access path with the right index type (GIN for JSONB/arrays, GiST for ranges/geometry, BRIN for time-series).
4. For a review pass, start from `references/review-checklist.md`.

## Decision tree

- Semi-structured data, `@>` / `?` queries, GIN indexing → `references/jsonb.md`
- Tag/category lists, ENUMs, domains, ranges, geometry → `references/arrays-and-custom-types.md`
- Slow query, EXPLAIN, index choice, pagination, connection/memory → `references/indexing.md`
- Running totals, rankings, LAG/LEAD, recursive hierarchies → `references/window-functions.md`
- `tsvector` / `tsquery` search and ranking → `references/full-text-search.md`
- Enabling/using extensions, monitoring, VACUUM/ANALYZE → `references/extensions.md`
- Auditing/reviewing PG code (anti-patterns, triggers, RLS, privileges, checklist) → `references/review-checklist.md`

## Topic index

| Topic | What's there | Reference |
|---|---|---|
| JSONB | GIN vs `jsonb_path_ops`, containment/path queries, generated-column extraction, anti-patterns | `references/jsonb.md` |
| Arrays & custom types | Array ops + GIN, ENUM/domain/composite types, range & geometric types, GiST | `references/arrays-and-custom-types.md` |
| Indexing & optimization | EXPLAIN ANALYZE, composite/partial/expression/covering indexes, index-type selection, pagination, monitoring, output format | `references/indexing.md` |
| Window functions & CTEs | Running totals, rankings, LAG/LEAD, recursive CTEs | `references/window-functions.md` |
| Full-text search | `tsvector`/`tsquery`, GIN, ranking, generated search columns | `references/full-text-search.md` |
| Extensions & maintenance | Common extensions, monitoring queries, VACUUM/ANALYZE, tuning tips | `references/extensions.md` |
| Review checklist | Anti-patterns, schema smells, function/trigger review, RLS & privileges, code-quality checklist | `references/review-checklist.md` |

Focus on specific, actionable optimizations that improve query performance, security, and maintainability while leveraging PostgreSQL's advanced features. For schema design specifically, see the `postgresql-table-design` skill.
