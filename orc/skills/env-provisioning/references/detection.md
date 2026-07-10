# Detection — rung specifics and inference tables

## Rung 1 — existing compose

Filename precedence (first found wins): `compose.yaml`, `compose.yml`, `docker-compose.yml`, `docker-compose.yaml`. Then layer, when present:

- `docker-compose.override.yml` / `compose.override.yaml` — auto-applied by compose; nothing to do.
- `compose.dev.yaml` / `docker-compose.dev.yml` — apply via extra `-f` only when the README/Makefile shows that usage.
- Profiles: `docker compose config --profiles`; activate `dev`/`development` when declared.

Never edit the project's compose. Extra needs (host-port remap, additional env) go into an orc-owned override file at `.orc/<branch>/files/docker/compose.orc-override.yaml`, appended with `-f`.

## Rung 2 — devcontainer.json field mapping

| devcontainer field | Provisioning meaning |
|---|---|
| `dockerComposeFile` (+ `service`) | Resolve to rung 1 with that file; `service` is the app service |
| `image` / `build.dockerfile` | Wrap in a generated compose app service |
| `forwardPorts` | Host port mappings; first HTTP-ish port becomes `appUrl` |
| `containerEnv` / `remoteEnv` | Env for the app service |
| `postCreateCommand` | One-shot after healthy (`docker compose exec` or `run --rm`) |
| `features` | Ignore (they provision the *IDE* container, not app deps) |

## Rung 4 — backing-service inference

Scan `.env.example`, `.env.sample`, config files (`config/*.{yml,json,ts}`), and docker-expert conventions. Match env-var patterns → generated service + healthcheck:

| Env pattern | Image | Healthcheck |
|---|---|---|
| `DATABASE_URL` (postgres://…), `POSTGRES_*`, `PG*` | `postgres:16-alpine` | `pg_isready -U $user` |
| `MYSQL_*` (mysql://…) | `mysql:8` | `mysqladmin ping -h localhost` |
| `REDIS_URL`, `REDIS_HOST` | `redis:7-alpine` | `redis-cli ping` |
| `MONGO_URL`, `MONGODB_URI` | `mongo:7` | `mongosh --eval "db.adminCommand('ping')"` |
| `AMQP_URL`, `RABBITMQ_*` | `rabbitmq:3-alpine` | `rabbitmq-diagnostics -q ping` |
| `S3_ENDPOINT`, `MINIO_*` | `minio/minio` | `curl -f http://localhost:9000/minio/health/live` |
| `SMTP_*`, `MAIL_HOST` | `axllent/mailpit` | `curl -f http://localhost:8025` (UI) |
| `ELASTICSEARCH_URL`, `OPENSEARCH_*` | `elasticsearch:8` (single-node, security off for dev) | `curl -f localhost:9200/_cluster/health` |
| `KAFKA_*` | prefer `redpandadata/redpanda` for dev | `rpk cluster health` |

Version pinning: honor an explicit version in the env value or README ("Postgres 15") over the table default.

## Setup-guideline parsing (cross-cutting, every rung)

Sources, in trust order:

1. **`.env.example`** — the variable list is authoritative for what the app needs. Copy to `env.orc`, fill dev-safe values (`localhost` hosts, generated service ports). Secrets (`*_SECRET`, `*_KEY`, `*_TOKEN`): keep the placeholder, surface a `[!WARNING]` listing what the user must fill — never invent values.
2. **README / CONTRIBUTING setup sections** — headings matching `Getting started|Setup|Development|Running locally`. Extract fenced commands: `docker compose …` (confirms rung 1 usage + flags), `make <target>`, migrate/seed commands (`prisma migrate dev`, `rails db:setup`, `npm run db:migrate`). Migrate/seed run as one-shots after services are healthy; anything that looks destructive (`reset`, `drop`, `force`) gates via `AskUserQuestion` first.
3. **Makefile** — targets named `dev`, `up`, `start`, `db`, `services`: read their recipes for the same signals.
4. **package.json scripts** (or equivalent) — `dev` script is the host-mode app command; `engines.node` / `.nvmrc` pins the node image for `--containerize-app`.

## App port / URL resolution

Priority: explicit `--web <url>` from caller > compose `ports:` on the app service > devcontainer `forwardPorts` > framework default (next/vite: 3000/5173, rails: 3000, django: 8000, spring: 8080) > `PORT` in `.env.example`. Resulting `appUrl` is always recorded in state and probed before any ready claim.
