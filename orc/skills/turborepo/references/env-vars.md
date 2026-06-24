# Environment Variables

Declaring environment dependencies so caching stays correct and runtime values are available — `env`, `globalEnv`, `passThroughEnv`, strict vs loose mode, and `.env` file handling.

See also: [environment/RULE.md](./environment/RULE.md) (`env`, `globalEnv`, `passThroughEnv`), [environment/modes.md](./environment/modes.md) (strict vs loose mode, framework inference), [environment/gotchas.md](./environment/gotchas.md) (`.env` files, CI issues), [caching.md](./caching.md).

## "Environment variables aren't working" decision tree

```
Environment issues?
├─ Vars not available at runtime → Strict mode filtering (default)
├─ Cache hits with wrong env → Var not in `env` key
├─ .env changes not causing rebuilds → .env not in `inputs`
├─ CI variables missing → references/environment/gotchas.md
└─ Framework vars (NEXT_PUBLIC_*) → Auto-included via inference
```

## Anti-Pattern: Root `.env` File in Monorepo

A `.env` file at the repo root is an anti-pattern — even for small monorepos or starter templates. It creates implicit coupling between packages and makes it unclear which packages depend on which variables.

```
// WRONG - root .env affects all packages implicitly
my-monorepo/
├── .env              # Which packages use this?
├── apps/
│   ├── web/
│   └── api/
└── packages/

// CORRECT - .env files in packages that need them
my-monorepo/
├── apps/
│   ├── web/
│   │   └── .env      # Clear: web needs DATABASE_URL
│   └── api/
│       └── .env      # Clear: api needs API_KEY
└── packages/
```

**Problems with root `.env`:**

- Unclear which packages consume which variables
- All packages get all variables (even ones they don't need)
- Cache invalidation is coarse-grained (root .env change invalidates everything)
- Security risk: packages may accidentally access sensitive vars meant for others
- Bad habits start small — starter templates should model correct patterns

**If you must share variables**, use `globalEnv` to be explicit about what's shared, and document why.

## Anti-Pattern: Strict Mode Filtering CI Variables

By default, Turborepo filters environment variables to only those in `env`/`globalEnv`. CI variables may be missing:

```json
// If CI scripts need GITHUB_TOKEN but it's not in env:
{
  "globalPassThroughEnv": ["GITHUB_TOKEN", "CI"],
  "tasks": { ... }
}
```

Or use `--env-mode=loose` (not recommended for production).

## Hashing `.env` files and env vars

Environment variables and `.env` files must be declared so cache invalidation is correct. See [caching.md](./caching.md) for the "Environment Variables Not Hashed" and "`.env` Files Not in Inputs" anti-patterns, and the `env` + `inputs` configuration patterns.
