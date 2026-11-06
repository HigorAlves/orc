# Caching

How Turborepo caching depends on hashed inputs (outputs, env vars, `.env` files), and the cache-related anti-patterns to avoid.

See also: [caching/RULE.md](./caching/RULE.md) (how caching works, hash inputs), [caching/gotchas.md](./caching/gotchas.md) (debugging misses, `--summarize`, `--dry`), [remote-cache.md](./remote-cache.md), [env-vars.md](./env-vars.md).

## "My cache isn't working" decision tree

```
Cache problems?
├─ Tasks run but outputs not restored → Missing `outputs` key
├─ Cache misses unexpectedly → references/caching/gotchas.md
├─ Need to debug hash inputs → Use --summarize or --dry
├─ Want to skip cache entirely → Use --force or cache: false
├─ Remote cache not working → references/remote-cache.md
└─ Environment causing misses → references/environment/gotchas.md
```

## Anti-Pattern: Environment Variables Not Hashed

```json
// WRONG: API_URL changes won't cause rebuilds
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
    }
  }
}

// CORRECT: API_URL changes invalidate cache
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "env": ["API_URL", "API_KEY"]
    }
  }
}
```

## Anti-Pattern: `.env` Files Not in Inputs

Turbo does NOT load `.env` files - your framework does. But Turbo needs to know about changes:

```json
// WRONG: .env changes don't invalidate cache
{
  "tasks": {
    "build": {
      "env": ["API_URL"]
    }
  }
}

// CORRECT: .env file changes invalidate cache
{
  "tasks": {
    "build": {
      "env": ["API_URL"],
      "inputs": ["$TURBO_DEFAULT$", ".env", ".env.*"]
    }
  }
}
```

## Anti-Pattern: Overly Broad `globalDependencies`

`globalDependencies` affects ALL tasks in ALL packages via the **global hash** — tasks cannot opt out of specific files, even with negation globs in `inputs`. Be specific.

```json
// WRONG - heavy hammer, affects all hashes
{
  "globalDependencies": ["**/.env.*local"]
}

// BETTER - move to task-level inputs
{
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    }
  }
}
```

With `futureFlags.globalConfiguration`, this problem is reduced because `global.inputs` files are folded into each task's inputs (not the global hash). Tasks can exclude specific files:

```json
// BEST - global.inputs with per-task exclusion
{
  "futureFlags": { "globalConfiguration": true },
  "global": {
    "inputs": [".env"]
  },
  "tasks": {
    "build": { "outputs": ["dist/**"] },
    "lint": {
      "inputs": ["$TURBO_DEFAULT$", "!$TURBO_ROOT$/.env"]
    }
  }
}
```

## NOT an Anti-Pattern: Large `env` Arrays

A large `env` array (even 50+ variables) is **not** a problem. It usually means the user was thorough about declaring their build's environment dependencies. Do not flag this as an issue.
