# Window Functions & CTEs

## Window functions

```sql
SELECT
    product_id,
    sale_date,
    amount,
    -- Running total
    SUM(amount) OVER (PARTITION BY product_id ORDER BY sale_date) AS running_total,
    -- Moving average (3-row window)
    AVG(amount) OVER (
        PARTITION BY product_id ORDER BY sale_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS moving_avg,
    -- Ranking within a month
    DENSE_RANK() OVER (
        PARTITION BY EXTRACT(month FROM sale_date) ORDER BY amount DESC
    ) AS monthly_rank,
    -- Prior row for period-over-period comparison
    LAG(amount, 1) OVER (PARTITION BY product_id ORDER BY sale_date) AS prev_amount,
    ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY amount DESC) AS row_rank
FROM sales;
```

Common window functions: `SUM/AVG/COUNT` (aggregate over a frame), `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`, `NTILE`.

## Common Table Expressions (CTEs)

```sql
-- Recursive query for hierarchical data
WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_id, 1 AS level
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    SELECT c.id, c.name, c.parent_id, ct.level + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree ORDER BY level, name;
```

Use recursive CTEs for trees/graphs (org charts, BOMs, category trees). Note: in modern PostgreSQL, non-recursive CTEs can be inlined by the planner, but add `MATERIALIZED` / `NOT MATERIALIZED` to force the behavior you want when it matters.
