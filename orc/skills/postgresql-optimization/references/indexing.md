# Indexing & Query Optimization

## Analyzing queries

```sql
-- EXPLAIN ANALYZE with buffers
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'::date
GROUP BY u.id, u.name;

-- Slowest queries from pg_stat_statements
SELECT query, calls, total_time, mean_time, rows,
       100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

## Index strategies

```sql
-- Composite index for multi-column queries (leftmost-prefix rule)
CREATE INDEX idx_orders_user_date ON orders(user_id, order_date);

-- Partial index for a hot filtered subset
CREATE INDEX idx_active_users ON users(created_at) WHERE status = 'active';

-- Expression index for computed values
CREATE INDEX idx_users_lower_email ON users(lower(email));

-- Covering index → index-only scans, avoids table lookups
CREATE INDEX idx_orders_covering ON orders(user_id, status) INCLUDE (total, created_at);
```

Index-type selection:

- **B-tree** — equality/range (`=`, `<`, `>`, `BETWEEN`, `ORDER BY`).
- **GIN** — JSONB containment/existence, arrays, full-text.
- **GiST** — ranges, geometry, exclusion constraints.
- **BRIN** — very large, naturally ordered (time-series) data.

## Connection & memory

```sql
-- Connection usage by state
SELECT count(*) AS connections, state
FROM pg_stat_activity
GROUP BY state;

-- Key memory settings
SELECT name, setting, unit
FROM pg_settings
WHERE name IN ('shared_buffers', 'work_mem', 'maintenance_work_mem');
```

## Common query patterns

```sql
-- Pagination — ❌ OFFSET on large datasets
SELECT * FROM products ORDER BY id OFFSET 10000 LIMIT 20;
-- ✅ Cursor-based (keyset) pagination
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;

-- Aggregation — back a hot filter with a partial index
CREATE INDEX idx_orders_recent ON orders(user_id) WHERE order_date >= '2024-01-01';
SELECT user_id, COUNT(*) FROM orders
WHERE order_date >= '2024-01-01' GROUP BY user_id;
```

## Monitoring & maintenance

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

-- Largest tables/indexes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Unused indexes
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

Routine maintenance: regular **VACUUM** and **ANALYZE**, rebuild fragmented indexes, keep planner statistics current, review logs. For high concurrency use connection pooling (pgbouncer); partition very large tables with declarative partitioning (PG10+).

## Optimization output format

When reporting a query analysis:

```
## Query Performance Analysis

**Original Query**: [SQL with issues]

**Issues Identified**:
- Sequential scan on large table (Cost: 15000.00)
- Missing index on frequently queried column
- Inefficient join order

**Optimized Query**: [improved SQL + explanation]

**Recommended Indexes**:
CREATE INDEX idx_table_column ON table(column);

**Performance Impact**: Expected ~80% reduction in execution time
```
