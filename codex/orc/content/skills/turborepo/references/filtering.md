# Filtering & Affected

Run only the packages you care about — by change set (`--affected`), by name, by directory, or by graph relationship (`...`).

See also: [filtering/RULE.md](./filtering/RULE.md) (`--filter` syntax overview), [filtering/patterns.md](./filtering/patterns.md) (common patterns), [cli/commands.md](./cli/commands.md).

## "I want to run only changed packages"

```
Run only what changed?
├─ Changed packages + dependents (RECOMMENDED) → turbo run build --affected
├─ Custom base branch → --affected --affected-base=origin/develop
├─ Manual git comparison → --filter=...[origin/main]
└─ See all filter options → references/filtering/RULE.md
```

**`--affected` is the primary way to run only changed packages.** It automatically compares against the default branch and includes dependents.

## "I want to filter packages"

```
Filter packages?
├─ Only changed packages → --affected (see above)
├─ By package name → --filter=web
├─ By directory → --filter=./apps/*
├─ Package + dependencies → --filter=web...
├─ Package + dependents → --filter=...web
└─ Complex combinations → references/filtering/patterns.md
```

For full `--filter` grammar and combinations, read [filtering/RULE.md](./filtering/RULE.md) and [filtering/patterns.md](./filtering/patterns.md).
