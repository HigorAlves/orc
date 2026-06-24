# Full-Text Search

PostgreSQL has built-in full-text search via `tsvector` / `tsquery`. Always specify the language configuration explicitly — never use the single-argument forms.

```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    search_vector tsvector
);

-- Populate the search vector
UPDATE documents
SET search_vector = to_tsvector('english', title || ' ' || content);

-- GIN index for search performance
CREATE INDEX idx_documents_search ON documents USING gin(search_vector);

-- Search
SELECT * FROM documents
WHERE search_vector @@ plainto_tsquery('english', 'postgresql database');

-- Ranked search
SELECT *, ts_rank(search_vector, plainto_tsquery('english', 'postgresql')) AS rank
FROM documents
WHERE search_vector @@ plainto_tsquery('english', 'postgresql')
ORDER BY rank DESC;
```

Notes:

- Prefer a **generated `tsvector` column** (`GENERATED ALWAYS AS (to_tsvector('english', ...)) STORED`) over manual `UPDATE`s so the vector stays in sync.
- Index `tsvector` columns with **GIN**.
- `to_tsquery` for operator syntax (`&`, `|`, `!`), `plainto_tsquery` / `websearch_to_tsquery` for user-supplied strings.
- For fuzzy / typo-tolerant matching use the `pg_trgm` extension (`similarity()`, `%` operator) — see `extensions.md`.
