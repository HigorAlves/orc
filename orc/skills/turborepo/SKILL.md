---
name: turborepo
description: "Turborepo monorepo build-system guidance — turbo.json task pipelines, caching, the turbo CLI, --filter/--affected, CI, env vars, and packages. Use when configuring tasks, sharing code between apps, or debugging the cache."
metadata:
  version: 2.9.7-canary.14
---

# Turborepo Skill

Build system for JavaScript/TypeScript monorepos. Turborepo caches task outputs and runs tasks in parallel based on the dependency graph.

This SKILL.md is an index. When you need the detail for a topic, **Read the matching `references/<topic>.md` file** — don't work from memory.

## When to use

Use when the user: configures tasks/workflows/pipelines, creates packages, sets up a monorepo, shares code between apps, runs changed/affected packages, debugs the cache, sets up CI, enforces package boundaries, or is working in a repo with `apps/`/`packages/` directories or a `turbo.json`.

## Two rules that always apply

1. **Package tasks, not Root Tasks.** Put task logic (scripts) in each package's `package.json`, register the task in root `turbo.json`, and let root `package.json` only delegate via `turbo run <task>`. Root Tasks (`//#taskname`) are a rare exception. See [references/tasks-pipeline.md](./references/tasks-pipeline.md).
2. **`turbo run`, not `turbo`, in code.** Always write `turbo run <task>` in package.json scripts and CI. The bare `turbo <task>` shorthand is only for one-off interactive terminal use. See [references/tasks-pipeline.md](./references/tasks-pipeline.md).

## Decision tree → which reference to read

```
What are you doing?
├─ Configuring a task / pipeline (dependsOn, outputs, transit nodes, dev/watch) → tasks-pipeline.md
├─ Cache not working / wrong cache hits / debugging hashes              → caching.md
├─ Sharing cache across machines / CI                                   → remote-cache.md
├─ Running only changed packages / --filter / --affected                → filtering.md
├─ Setting up CI (GitHub Actions, Vercel, turbo-ignore)                 → ci.md
├─ Env vars not available / wrong cache from env / .env files           → env-vars.md
├─ Creating a package / structuring the monorepo / dependencies         → packages.md
└─ Enforcing import/architectural boundaries                            → boundaries.md
```

## Topic index

| Topic | Read this | Covers |
| --- | --- | --- |
| Tasks & pipeline | [references/tasks-pipeline.md](./references/tasks-pipeline.md) | Package-vs-Root tasks, `turbo run` rule, `dependsOn`/`^build`, outputs, transit nodes, dev/watch patterns, task anti-patterns |
| Caching | [references/caching.md](./references/caching.md) | Hash inputs, missing `outputs`, env/`.env` hashing, `globalDependencies`, debugging misses |
| Remote cache | [references/remote-cache.md](./references/remote-cache.md) | Vercel Remote Cache, self-hosted, `turbo login`/`link` |
| Filtering & affected | [references/filtering.md](./references/filtering.md) | `--affected`, `--filter` by name/dir/`...`, change-set runs |
| CI / CD | [references/ci.md](./references/ci.md) | GitHub Actions, Vercel, `turbo-ignore`, `--affected` in CI, passthrough env |
| Env vars | [references/env-vars.md](./references/env-vars.md) | `env`/`globalEnv`/`passThroughEnv`, strict vs loose, root `.env` anti-pattern |
| Packages & structure | [references/packages.md](./references/packages.md) | Internal packages, `apps/`/`packages/` layout, deps, JIT vs compiled |
| Boundaries | [references/boundaries.md](./references/boundaries.md) | `turbo boundaries`, tags, tag-based import rules |

## Deeper reference subtrees

The topic files above link into the detailed `references/` subtrees when you need full mechanics:

- **Configuration** — [configuration/RULE.md](./references/configuration/RULE.md) (turbo.json overview, Package Configurations), [configuration/tasks.md](./references/configuration/tasks.md) (dependsOn, outputs, inputs, env, cache, persistent), [configuration/global-options.md](./references/configuration/global-options.md) (globalEnv, globalDependencies, `global` key, futureFlags, cacheDir, envMode), [configuration/gotchas.md](./references/configuration/gotchas.md).
- **Caching** — [caching/RULE.md](./references/caching/RULE.md), [caching/remote-cache.md](./references/caching/remote-cache.md), [caching/gotchas.md](./references/caching/gotchas.md) (`--summarize`, `--dry`).
- **Environment** — [environment/RULE.md](./references/environment/RULE.md), [environment/modes.md](./references/environment/modes.md), [environment/gotchas.md](./references/environment/gotchas.md).
- **Filtering** — [filtering/RULE.md](./references/filtering/RULE.md), [filtering/patterns.md](./references/filtering/patterns.md).
- **CI/CD** — [ci/RULE.md](./references/ci/RULE.md), [ci/github-actions.md](./references/ci/github-actions.md), [ci/vercel.md](./references/ci/vercel.md), [ci/patterns.md](./references/ci/patterns.md).
- **CLI** — [cli/RULE.md](./references/cli/RULE.md), [cli/commands.md](./references/cli/commands.md) (`turbo run` flags, `turbo-ignore`, other commands).
- **Best practices** — [best-practices/RULE.md](./references/best-practices/RULE.md), [best-practices/structure.md](./references/best-practices/structure.md), [best-practices/packages.md](./references/best-practices/packages.md), [best-practices/dependencies.md](./references/best-practices/dependencies.md).
- **Watch mode** — [watch/RULE.md](./references/watch/RULE.md) (`turbo watch`, interruptible tasks, dev workflows).
- **Boundaries** — [boundaries/RULE.md](./references/boundaries/RULE.md).

## Source Documentation

This skill is based on the official Turborepo documentation:

- Source: `apps/docs/content/docs/` in the Turborepo repository
- Live: https://turborepo.dev/docs
