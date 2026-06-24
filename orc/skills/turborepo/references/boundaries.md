# Boundaries (Experimental)

Enforce package isolation with `turbo boundaries` — tag packages and define tag-based rules that restrict which packages may import which, and prevent cross-package file imports.

Full mechanics (tags, rule types, configuration) live in [boundaries/RULE.md](./boundaries/RULE.md). Read that file for details.

## "I want to enforce architectural boundaries"

```
Enforce boundaries?
├─ Check for violations → turbo boundaries
├─ Tag packages → references/boundaries/RULE.md#tags
├─ Restrict which packages can import others → references/boundaries/RULE.md#rule-types
└─ Prevent cross-package file imports → references/boundaries/RULE.md
```

## Related anti-pattern

Reaching into another package's internals (e.g. `import ... from "../../packages/ui/src/button"`) is a boundary violation. See [packages.md](./packages.md) "Accessing Files Across Package Boundaries".
