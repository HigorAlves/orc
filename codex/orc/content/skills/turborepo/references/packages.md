# Packages & Monorepo Structure

Creating internal packages, structuring the repo (`apps/`, `packages/`), managing dependencies, and the structural anti-patterns that break monorepo principles.

See also: [best-practices/RULE.md](./best-practices/RULE.md) (overview, package types), [best-practices/structure.md](./best-practices/structure.md) (repository structure, workspace + TypeScript/ESLint config), [best-practices/packages.md](./best-practices/packages.md) (creating internal packages, JIT vs Compiled, exports), [best-practices/dependencies.md](./best-practices/dependencies.md) (dependency management, version sync).

## "I need to create/structure a package"

```
Package creation/structure?
├─ Create an internal package → references/best-practices/packages.md
├─ Repository structure → references/best-practices/structure.md
├─ Dependency management → references/best-practices/dependencies.md
├─ Best practices overview → references/best-practices/RULE.md
├─ JIT vs Compiled packages → references/best-practices/packages.md#compilation-strategies
└─ Sharing code between apps → references/best-practices/RULE.md#package-types
```

## "How should I structure my monorepo?"

```
Monorepo structure?
├─ Standard layout (apps/, packages/) → references/best-practices/RULE.md
├─ Package types (apps vs libraries) → references/best-practices/RULE.md#package-types
├─ Creating internal packages → references/best-practices/packages.md
├─ TypeScript configuration → references/best-practices/structure.md#typescript-configuration
├─ ESLint configuration → references/best-practices/structure.md#eslint-configuration
├─ Dependency management → references/best-practices/dependencies.md
└─ Enforce package boundaries → references/boundaries/RULE.md
```

## Anti-Pattern: Shared Code in Apps (Should Be a Package)

```
// WRONG: Shared code inside an app
apps/
  web/
    shared/          # This breaks monorepo principles!
      utils.ts

// CORRECT: Extract to a package
packages/
  utils/
    src/utils.ts
```

## Anti-Pattern: Accessing Files Across Package Boundaries

```typescript
// WRONG: Reaching into another package's internals
import { Button } from "../../packages/ui/src/button";

// CORRECT: Install and import properly
import { Button } from "@repo/ui/button";
```

See [boundaries.md](./boundaries.md) to enforce this mechanically with `turbo boundaries`.

## Anti-Pattern: Too Many Root Dependencies

```json
// WRONG: App dependencies in root
{
  "dependencies": {
    "react": "^18",
    "next": "^14"
  }
}

// CORRECT: Only repo tools in root
{
  "devDependencies": {
    "turbo": "latest"
  }
}
```
