# CI / CD

Running Turborepo in CI: build only what changed, share the remote cache, and skip unnecessary container/build setup.

See also: [ci/RULE.md](./ci/RULE.md) (general CI principles), [ci/github-actions.md](./ci/github-actions.md) (complete GitHub Actions setup), [ci/vercel.md](./ci/vercel.md) (Vercel deployment, turbo-ignore), [ci/patterns.md](./ci/patterns.md) (`--affected`, caching strategies), [remote-cache.md](./remote-cache.md).

## "I need to set up CI"

```
CI setup?
├─ GitHub Actions → references/ci/github-actions.md
├─ Vercel deployment → references/ci/vercel.md
├─ Remote cache in CI → references/remote-cache.md
├─ Only build changed packages → --affected flag
├─ Skip unnecessary builds → turbo-ignore (references/cli/commands.md)
└─ Skip container setup when no changes → turbo-ignore
```

## Anti-Pattern: Using `turbo` Shorthand in CI

Always use `turbo run` in CI workflows, never the `turbo <task>` shorthand:

```yaml
# WRONG - using shorthand in CI
- run: turbo build --affected

# CORRECT
- run: turbo run build --affected
```

See [tasks-pipeline.md](./tasks-pipeline.md) for the full `turbo run` vs `turbo` rule.

## Anti-Pattern: Strict Mode Filtering CI Variables

By default, Turborepo filters environment variables to only those in `env`/`globalEnv`. CI variables may be missing:

```json
// If CI scripts need GITHUB_TOKEN but it's not in env:
{
  "globalPassThroughEnv": ["GITHUB_TOKEN", "CI"],
  "tasks": { ... }
}
```

Or use `--env-mode=loose` (not recommended for production). See [env-vars.md](./env-vars.md) and [environment/modes.md](./environment/modes.md).
