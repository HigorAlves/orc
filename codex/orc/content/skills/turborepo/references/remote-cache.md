# Remote Cache

Sharing the Turborepo cache across machines and CI via Vercel Remote Cache or a self-hosted endpoint.

The detailed setup (login/link, self-hosted endpoints, signature verification) lives in [caching/remote-cache.md](./caching/remote-cache.md). Read that file for full instructions.

## When you need remote cache

- Sharing task output between CI runs and across developers
- Speeding up CI by restoring outputs produced on another machine
- Skipping rebuilds for packages unchanged since the last successful CI run

## Quick pointers

- Hosted: `turbo login` then `turbo link` to connect to Vercel Remote Cache.
- Self-hosted / custom: configure the remote cache endpoint and token (see [caching/remote-cache.md](./caching/remote-cache.md)).
- In CI, supply the cache token/team via environment so `turbo run` can read and write the shared cache. See [ci.md](./ci.md) and [ci/github-actions.md](./ci/github-actions.md).
