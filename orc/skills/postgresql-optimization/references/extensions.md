# Extensions & Maintenance

## Useful extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- crypto + UUIDs (prefer for new projects)
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- strip accents
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram / fuzzy matching
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- GIN indexes over btree types

-- Usage
SELECT uuid_generate_v4();                     -- UUID
SELECT crypt('password', gen_salt('bf'));      -- bcrypt password hash
SELECT similarity('postgresql', 'postgersql'); -- fuzzy match score
SELECT word_similarity('postgres', 'postgre'); -- partial fuzzy match
```

Always guard with `IF NOT EXISTS`. Other commonly-needed extensions: `timescaledb` (time-series partitioning/compression/continuous aggregates), `postgis` (geospatial), `pgvector` (embedding similarity search), `citext` (case-insensitive text), `hstore` (key-value, mostly superseded by JSONB), `pgaudit` (audit logging).

## Monitoring & maintenance

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

-- Table + index sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Slow queries
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Unused indexes
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

Maintenance checklist:

- **VACUUM / ANALYZE** regularly (autovacuum tuning for churny tables).
- Monitor and rebuild fragmented/bloated indexes.
- Keep planner statistics current.
- Review PostgreSQL logs regularly.
- Use `pg_stat_statements` for ongoing query performance monitoring.

## PostgreSQL-specific tips

- Use `EXPLAIN (ANALYZE, BUFFERS)` for detailed query analysis.
- Tune `postgresql.conf` for the workload (OLTP vs OLAP).
- Use connection pooling (pgbouncer) for high-concurrency apps.
- Partition large tables with declarative partitioning (PG10+).
