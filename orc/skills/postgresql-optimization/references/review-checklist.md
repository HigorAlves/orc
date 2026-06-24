# PostgreSQL Review Checklist

Use this as the review lens when auditing PostgreSQL code. For the deep-dive examples behind each item, see the sibling references: `jsonb.md`, `arrays-and-custom-types.md`, `indexing.md`, `full-text-search.md`, `extensions.md`.

## Anti-patterns to flag

**Performance**
- Avoiding PostgreSQL-specific indexes — not using GIN/GiST for JSONB, arrays, ranges, geometry.
- Misusing JSONB — treating it like a plain string field; `::text LIKE '%...%'` or `->>` comparisons instead of `@>` + GIN.
- Ignoring array operators — `= ANY(arr)` scans instead of GIN-indexed `@>`.
- Poor partition-key selection — not leveraging declarative partitioning effectively.

**Schema design**
- Using `VARCHAR(n)` for limited value sets instead of ENUM (or TEXT/INT + CHECK / lookup table).
- Missing CHECK constraints for data validation.
- `VARCHAR` instead of `TEXT` / `CITEXT`; `TIMESTAMP` instead of `TIMESTAMPTZ`.
- Unstructured JSONB with no shape constraint.
- Generic types where a domain/composite type would enforce invariants.

```sql
-- ❌ BAD: not using PostgreSQL features
CREATE TABLE users (id INTEGER, email VARCHAR(255), created_at TIMESTAMP);

-- ✅ GOOD: PostgreSQL-optimized schema
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email CITEXT UNIQUE NOT NULL,            -- case-insensitive
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
CREATE INDEX idx_users_metadata ON users USING gin(metadata);
```

## Function & trigger review

```sql
-- ✅ Use CURRENT_TIMESTAMP / NOW() into a TIMESTAMPTZ column
CREATE OR REPLACE FUNCTION update_modified_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Fire only when the row actually changed
CREATE TRIGGER update_modified_time_trigger
    BEFORE UPDATE ON table_name
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION update_modified_time();
```

- Review PL/pgSQL for efficiency and proper error handling.
- `CREATE OR REPLACE` with a different argument list creates an **overload**, not a replacement — drop the old version if unintended.

## Security review

```sql
-- Row Level Security
ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_data_policy ON sensitive_data
    FOR ALL TO application_role
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- ❌ BAD: overly broad grant
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
-- ✅ GOOD: granular privileges
GRANT SELECT, INSERT, UPDATE ON specific_table TO app_user;
GRANT USAGE ON SEQUENCE specific_table_id_seq TO app_user;
```

## Code-quality checklist

**Schema design**
- [ ] Appropriate PostgreSQL types (CITEXT, JSONB, arrays).
- [ ] ENUM types for constrained value sets.
- [ ] Proper CHECK constraints.
- [ ] TIMESTAMPTZ instead of TIMESTAMP.
- [ ] Custom domains for reusable constraints.

**Performance**
- [ ] Correct index types (GIN for JSONB/arrays, GiST for ranges).
- [ ] JSONB queries use containment operators (`@>`, `?`).
- [ ] Array operations use PostgreSQL-specific operators.
- [ ] Proper use of window functions and CTEs.
- [ ] EXPLAIN ANALYZE run on expensive queries; no surprise sequential scans on large tables.
- [ ] Unused/duplicate indexes removed.

**Feature utilization**
- [ ] Extensions used where appropriate.
- [ ] PL/pgSQL stored procedures used when beneficial, with error handling.
- [ ] PostgreSQL advanced SQL features leveraged.

**Security & compliance**
- [ ] Parameterized queries only.
- [ ] Row Level Security where needed.
- [ ] Granular role/privilege management.
- [ ] Built-in encryption functions for sensitive data.
- [ ] Audit trails (e.g. `pgaudit`).

## Review guidelines

1. **Data-type optimization** — PostgreSQL-specific types used appropriately.
2. **Index strategy** — correct, PostgreSQL-specific index types.
3. **JSONB structure** — sane schema design and query patterns.
4. **Function quality** — efficient, well-handled PL/pgSQL.
5. **Extension usage** — appropriate, guarded with `IF NOT EXISTS`.
6. **Performance features** — advanced features actually used.
7. **Security** — RLS, privileges, encryption reviewed.

Bottom line: ensure the code leverages what makes PostgreSQL special rather than treating it as a generic SQL database.
