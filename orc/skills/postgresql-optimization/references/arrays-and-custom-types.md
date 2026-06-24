# Arrays & Custom Types

## Array operations

```sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    tags TEXT[],
    categories INTEGER[]
);

-- Queries and operations
SELECT * FROM posts WHERE 'postgresql' = ANY(tags);
SELECT * FROM posts WHERE tags && ARRAY['database', 'sql'];   -- overlap
SELECT * FROM posts WHERE array_length(tags, 1) > 3;

-- Aggregation
SELECT array_agg(DISTINCT category) FROM posts, unnest(categories) AS category;
```

**Index arrays with GIN** for containment (`@>`, `<@`) and overlap (`&&`):

```sql
-- ❌ BAD: ANY() scan, no index
SELECT * FROM products WHERE 'electronics' = ANY(categories);
-- ✅ GOOD: GIN-indexed containment
CREATE INDEX idx_products_categories ON products USING gin(categories);
SELECT * FROM products WHERE categories @> ARRAY['electronics'];

-- ✅ GOOD: bulk array update, not row-by-row in a loop
UPDATE products SET categories = categories || ARRAY['new_category']
WHERE id IN (SELECT id FROM products WHERE condition);
```

Good for tags/categories; avoid arrays for relations — use junction tables.

## Custom types & domains

```sql
-- Composite type
CREATE TYPE address_type AS (
    street TEXT, city TEXT, postal_code TEXT, country TEXT
);

-- ENUM for small, stable value sets
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- Domain for reusable validation
CREATE DOMAIN email_address AS TEXT
CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email email_address NOT NULL,
    address address_type,
    status order_status DEFAULT 'pending'
);
```

Review lens — prefer domain-specific types over generic ones:

```sql
-- ❌ BAD: generic types for specific data
CREATE TABLE transactions (amount DECIMAL(10,2), currency VARCHAR(3), status VARCHAR(20));

-- ✅ GOOD: ENUMs + domain
CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'JPY');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE DOMAIN positive_amount AS DECIMAL(10,2) CHECK (VALUE > 0);
CREATE TABLE transactions (
    amount positive_amount NOT NULL,
    currency currency_code NOT NULL,
    status transaction_status DEFAULT 'pending'
);
```

Use ENUM for small/stable sets; for evolving business values (order statuses) prefer TEXT/INT + CHECK or a lookup table.

## Range types

```sql
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    room_id INTEGER,
    reservation_period tstzrange,
    price_range numrange
);

-- Overlap queries
SELECT * FROM reservations
WHERE reservation_period && tstzrange('2024-07-20', '2024-07-25');

-- Exclude overlapping ranges (no double-booking)
ALTER TABLE reservations
ADD CONSTRAINT no_overlap
EXCLUDE USING gist (room_id WITH =, reservation_period WITH &&);
```

Index range types with **GiST**. Pick a bounds scheme and use it consistently (prefer `[)`).

## Geometric types

```sql
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name TEXT,
    coordinates POINT,
    coverage CIRCLE,
    service_area POLYGON
);

-- Distance query
SELECT name FROM locations
WHERE coordinates <-> point(40.7128, -74.0060) < 10;

-- GiST index for geometric data
CREATE INDEX idx_locations_coords ON locations USING gist(coordinates);
```

For serious spatial work, use **PostGIS** rather than the built-in geometric types.
