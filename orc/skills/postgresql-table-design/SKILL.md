---
name: postgresql-table-design
description: 'Design or review a PostgreSQL-specific schema: data types, indexing, constraints, partitioning, RLS, performance patterns, and advanced features. Use when modeling or auditing PG tables.'
---

# PostgreSQL Table Design

This SKILL.md is a thin index — the Core Rules and Gotchas below cover most design/review calls; Read the relevant `references/*.md` on demand for the rest, never all up front.

## Core Rules

- Define a **PRIMARY KEY** for reference tables (users, orders, etc.). Not always needed for time-series/event/log data. When used, prefer `BIGINT GENERATED ALWAYS AS IDENTITY`; use `UUID` only when global uniqueness/opacity is needed.
- **Normalize first (to 3NF)** to eliminate data redundancy and update anomalies; denormalize **only** for measured, high-ROI reads where join performance is proven problematic. Premature denormalization creates maintenance burden.
- Add **NOT NULL** everywhere it's semantically required; use **DEFAULT**s for common values.
- Create **indexes for access paths you actually query**: PK/unique (auto), **FK columns (manual!)**, frequent filters/sorts, and join keys.
- Prefer **TIMESTAMPTZ** for event time; **NUMERIC** for money; **TEXT** for strings; **BIGINT** for integer values, **DOUBLE PRECISION** for floats (or `NUMERIC` for exact decimal arithmetic).

## PostgreSQL "Gotchas"

- **Identifiers**: unquoted → lowercased. Avoid quoted/mixed-case names. Convention: `snake_case` for table/column names.
- **Unique + NULLs**: UNIQUE allows multiple NULLs. Use `UNIQUE (...) NULLS NOT DISTINCT` (PG15+) to restrict to one NULL.
- **FK indexes**: PostgreSQL **does not** auto-index FK columns. Add them.
- **No silent coercions**: length/precision overflows error out (no truncation).
- **Sequences/identity have gaps** (normal; don't "fix").
- **Heap storage**: no clustered PK by default; `CLUSTER` is one-off, not maintained.
- **MVCC**: updates/deletes leave dead tuples; vacuum handles them — design to avoid hot wide-row churn.

## Detail map (read on demand)

| Question | Reference |
|----------|-----------|
| Which type for X? Banned types (`char(n)`, `money`, `timestamp` w/o tz, `serial`)? Table types, generated columns | [DATA-TYPES.md](references/DATA-TYPES.md) |
| RLS, constraint shapes, which index kind (B-tree/GIN/GiST/BRIN, partial, covering), when to partition | [INDEXING-CONSTRAINTS-PARTITIONING.md](references/INDEXING-CONSTRAINTS-PARTITIONING.md) |
| Update-heavy / insert-heavy / upsert designs, safe schema evolution, useful extensions | [WORKLOAD-PATTERNS.md](references/WORKLOAD-PATTERNS.md) |
| JSONB vs columns, indexing JSONB | [JSONB.md](references/JSONB.md) |
| Worked schemas (users, orders, JSONB) | [EXAMPLES.md](references/EXAMPLES.md) |

For query-side work (JSONB operators, window functions, full-text search, PG-unique SQL) use `orc:postgresql-optimization` instead.
