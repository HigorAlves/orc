# LOC budget — estimating est_loc and the stack signal

Disclosed from `orc:writing-plans`. Read when filling `est_loc` on a task header, when a Graphify graph is available for blast-radius, or when a task's decomposition exceeds the budget.

Add an `est_loc: <int>` field to every task header. Heuristic for the estimate:

```
est_loc ≈ (new_files * 80) + (modified_files * 30) + boilerplate_test_lines
```

Adjust upward for known-large files (config, fixtures), downward for one-line tweaks.

When a Graphify code graph is available (per `orc:code-discovery`), sharpen the `modified_files` term with real blast-radius: `graphify affected "<symbol-you'll-change>" --depth 2` lists the call sites that ripple from a change. Count each caller you'll actually have to touch as ~+30 LOC, and treat a symbol with many affected callers as a **`ships_as_stack: true`** signal *before* implementation, not a surprise at ship time. `affected` is a lead, not proof — it doesn't expose per-edge confidence — so read each cited caller to confirm it needs to change before counting it. Fall back to `Grep` for callers when no graph is available.

When a task's natural decomposition would exceed **1.5× the budget** (~450 LOC), that's a planning signal:

- **Split the task further.** Usually there's a refactor-then-feature seam that hasn't been surfaced yet.
- **OR mark `ships_as_stack: true`** in the task header to signal the implementer that this task is expected to ship as a stacked PR group via `/orc:stack-pr`. Don't quietly accept a 600-LOC task.

The estimate is a **budget contract**, not a precision prediction — the implementer escalates when actual exceeds `est_loc * 1.5` rather than ballooning silently.
