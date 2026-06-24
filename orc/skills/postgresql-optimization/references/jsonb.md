# JSONB Operations

Use JSONB (not JSON) for semi-structured data. Index with **GIN** so containment/existence queries are fast. Keep core relations in real columns; reserve JSONB for optional/variable attributes.

## Core operations

```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GIN index for JSONB performance
CREATE INDEX idx_events_data_gin ON events USING gin(data);

-- Containment and path queries
SELECT * FROM events
WHERE data @> '{"type": "login"}'
  AND data #>> '{user,role}' = 'admin';

-- JSONB aggregation
SELECT jsonb_agg(data) FROM events WHERE data ? 'user_id';
```

## Indexing strategy

- **Default GIN** accelerates containment `@>`, key existence `?`, any/all keys `?|` / `?&`, and path containment:
  - `CREATE INDEX ON tbl USING GIN (jsonb_col);`
- **`jsonb_path_ops`** for containment-only workloads → smaller/faster index but loses `?`, `?|`, `?&`:
  - `CREATE INDEX ON tbl USING GIN (jsonb_col jsonb_path_ops);`
- **Equality/range on a scalar field**: extract to a generated column + B-tree:
  - `ALTER TABLE tbl ADD COLUMN price INT GENERATED ALWAYS AS ((jsonb_col->>'price')::INT) STORED;`
  - `CREATE INDEX ON tbl (price);`
  - Prefer `WHERE price BETWEEN 100 AND 500` over an unindexed `WHERE (jsonb_col->>'price')::INT BETWEEN ...`.
- **Arrays inside JSONB**: GIN + `@>` for containment (e.g. tags); `jsonb_path_ops` if only containment.
- **Disjunction**: `jsonb_col @> ANY(ARRAY['{"status":"active"}', '{"status":"pending"}'])`.

## Anti-patterns (review lens)

```sql
-- ❌ BAD: text LIKE on JSON — no index support
SELECT * FROM users WHERE data::text LIKE '%admin%';
-- ✅ GOOD: containment operator + GIN index
CREATE INDEX idx_users_data_gin ON users USING gin(data);
SELECT * FROM users WHERE data @> '{"role": "admin"}';

-- ❌ BAD: ->> comparison, no index used
SELECT * FROM orders WHERE data->>'status' = 'shipped';
-- ✅ GOOD: containment + expression GIN index
CREATE INDEX idx_orders_status ON orders USING gin((data->'status'));
SELECT * FROM orders WHERE data @> '{"status": "shipped"}';

-- ❌ BAD: deep nesting with no validation
UPDATE orders SET data = data || '{"shipping":{"tracking":{"number":"123"}}}';
-- ✅ GOOD: constrain allowed JSONB values
ALTER TABLE orders ADD CONSTRAINT valid_status
CHECK (data->>'status' IN ('pending', 'shipped', 'delivered'));
```

- Constrain shape where it matters: `config JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object')`.
- Treating JSONB like a plain string field (no operators, no index) is the most common misuse.
