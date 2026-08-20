# Workload patterns + extensions

## Special Considerations

### Update-Heavy Tables

- **Separate hot/cold columns**—put frequently updated columns in separate table to minimize bloat.
- **Use `fillfactor=90`** to leave space for HOT updates that avoid index maintenance.
- **Avoid updating indexed columns**—prevents beneficial HOT updates.
- **Partition by update patterns**—separate frequently updated rows in a different partition from stable data.

### Insert-Heavy Workloads

- **Minimize indexes**—only create what you query; every index slows inserts.
- **Use `COPY` or multi-row `INSERT`** instead of single-row inserts.
- **UNLOGGED tables** for rebuildable staging data—much faster writes.
- **Defer index creation** for bulk loads—>drop index, load data, recreate indexes.
- **Partition by time/hash** to distribute load. **TimescaleDB** automates partitioning and compression of insert-heavy data.
- **Use a natural key for primary key** such as a (timestamp, device_id) if enforcing global uniqueness is important many insert-heavy tables don't need a primary key at all.
- If you do need a surrogate key, **Prefer `BIGINT GENERATED ALWAYS AS IDENTITY` over `UUID`**.

### Upsert-Friendly Design

- **Requires UNIQUE index** on conflict target columns—`ON CONFLICT (col1, col2)` needs exact matching unique index (partial indexes don't work).
- **Use `EXCLUDED.column`** to reference would-be-inserted values; only update columns that actually changed to reduce write overhead.
- **`DO NOTHING` faster** than `DO UPDATE` when no actual update needed.

### Safe Schema Evolution

- **Transactional DDL**: most DDL operations can run in transactions and be rolled back—`BEGIN; ALTER TABLE...; ROLLBACK;` for safe testing.
- **Concurrent index creation**: `CREATE INDEX CONCURRENTLY` avoids blocking writes but can't run in transactions.
- **Volatile defaults cause rewrites**: adding `NOT NULL` columns with volatile defaults (e.g., `now()`, `gen_random_uuid()`) rewrites entire table. Non-volatile defaults are fast.
- **Drop constraints before columns**: `ALTER TABLE DROP CONSTRAINT` then `DROP COLUMN` to avoid dependency issues.
- **Function signature changes**: `CREATE OR REPLACE` with different arguments creates overloads, not replacements. DROP old version if no overload desired.


## Extensions

- **`pgcrypto`**: `crypt()` for password hashing.
- **`uuid-ossp`**: alternative UUID functions; prefer `pgcrypto` for new projects.
- **`pg_trgm`**: fuzzy text search with `%` operator, `similarity()` function. Index with GIN for `LIKE '%pattern%'` acceleration.
- **`citext`**: case-insensitive text type. Prefer expression indexes on `LOWER(col)` unless you need case-insensitive constraints.
- **`btree_gin`/`btree_gist`**: enable mixed-type indexes (e.g., GIN index on both JSONB and text columns).
- **`hstore`**: key-value pairs; mostly superseded by JSONB but useful for simple string mappings.
- **`timescaledb`**: essential for time-series—automated partitioning, retention, compression, continuous aggregates.
- **`postgis`**: comprehensive geospatial support beyond basic geometric types—essential for location-based applications.
- **`pgvector`**: vector similarity search for embeddings.
- **`pgaudit`**: audit logging for all database activity.

