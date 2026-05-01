# 04 — Writing documentation

## Scenario

You just shipped a new internal service for sending bulk emails (`mailer`). It has zero docs. You've also been meaning to document the messaging-queue conventions across services. Two distinct doc tasks.

orc treats docs as a first-class workflow, not an afterthought.

## Two flows depending on the case

### Case A — New package/service from scratch

```
/orc:scaffold mailer --type=service
       └─→ orc:create-readme   (README.md)
              └─→ orc:documentation-writer  (Diátaxis-shaped docs/)
                     └─→ orc:tdd  (first failing test)
                            └─→ orc:git-commit  (initial commit)
```

### Case B — Documenting an existing system

You don't need `/orc:scaffold` (the service already exists). Instead, invoke the docs skills directly via the Skill tool:

```
1. orc:documentation-writer   ← lay out Diátaxis quadrants in docs/
2. orc:create-readme          ← refresh the package README
3. /orc:adr  for any architectural facts that should be locked in (e.g. "we use Kafka for cross-service messaging")
```

## Walk-through (Case A)

### Phase 1 — Scaffold

```
/orc:scaffold mailer --type=service
```

`AskUserQuestion` walks you through:

- Where does this live? (project root / `packages/` / `services/` / `apps/`)
- Language? (TypeScript / Go / Rust / Python)
- License? (inherit from repo)

Answer: `services/mailer/`, TypeScript, MIT (inherit).

Runs `npm init -y` in `services/mailer/`. Creates the directory shell.

### Phase 2 — Author README

`orc:create-readme` fills in:

```
# mailer

Bulk email sending service. Used by: <list of consumers>.

## What

<one paragraph>

## Why

<problem this solves; constraints>

## Install

<command>

## Usage

<minimal example>

## Test

<command>

## License

MIT — see /LICENSE
```

Empty sections become real text, not "TBD."

### Phase 3 — Diátaxis docs

`orc:documentation-writer` lays out four quadrants under `services/mailer/docs/`:

```
services/mailer/docs/
├── README.md                    # links to the four quadrants
├── tutorial/
│   └── send-your-first-email.md # learning-oriented, hand-holding
├── how-to/
│   ├── add-a-new-template.md    # task-oriented, recipe
│   └── retry-failed-deliveries.md
├── reference/
│   ├── api.md                   # information-oriented, exhaustive
│   └── config.md
└── explanation/
    ├── why-not-sendgrid.md      # understanding-oriented
    └── architecture.md
```

The skill enforces: **one purpose per page**. A "tutorial" that drifts into reference content gets refactored.

### Phase 4 — First failing test

`orc:tdd` writes the simplest possible failing test for the entry point. Runs the suite — it fails meaningfully (not "test not found").

### Phase 5 — First commit

`orc:git-commit` produces:

```
chore(mailer): initialize service skeleton

- README, Diátaxis-shaped docs/, MIT LICENSE inherited
- First failing test for entry point
- npm init scaffolding
```

Conventional Commits format. No AI attribution.

## Walk-through (Case B — existing system)

You're documenting an existing messaging-queue convention used by several services. No new package; just docs.

### Step 1 — Diátaxis check

Invoke `orc:documentation-writer`. Audit the existing docs vs the four quadrants:

- Tutorial: do we have one? If not, write a "first message" walk-through.
- How-to: do we have task recipes ("how do I retry?", "how do I dead-letter?")?
- Reference: API/config docs?
- Explanation: WHY did we pick Kafka over SQS? Why this topic-naming convention?

For each quadrant that's missing or thin, propose new pages.

### Step 2 — Lock in the durable decisions as ADRs

If documenting "we use Kafka for cross-service messaging" surfaces a decision that doesn't have an ADR yet:

```
/orc:adr "use Kafka as cross-service event bus"
```

The doc then *links to* the ADR for the why, instead of restating it. ADRs are the durable record; explanation docs reference them.

## Artifacts

For Case A:
```
services/mailer/
├── README.md
├── package.json
├── docs/
│   ├── README.md
│   ├── tutorial/...
│   ├── how-to/...
│   ├── reference/...
│   └── explanation/...
└── src/__tests__/<one failing test>
```

For Case B:
```
docs/                                        # at repo root
├── how-to/handle-dead-letter-queue.md       # new
└── explanation/cross-service-messaging.md   # new
docs/adr/0007-use-kafka-for-events.md        # new ADR
```

## Done when

- Each Diátaxis quadrant has at least one page (or is explicitly marked N/A with a reason in the docs README).
- Tutorials walk a fresh reader from "knows nothing" to "shipped a thing" successfully — verify by handing the tutorial to a junior teammate.
- Reference docs are complete enough that a maintainer can answer common operational questions without source-code archaeology.
- ADRs exist for any durable architectural decision the docs mention.

## Variants

- **Solo project, light docs** — a thorough README + a single `docs/architecture.md` may be enough. Don't manufacture Diátaxis quadrants if there's nothing to put in them.
- **Public-facing docs site (Docusaurus / Mintlify / etc.)** — same Diátaxis structure, just rendered. orc doesn't ship a docs builder; you wire the existing markdown into your tool of choice.
- **API reference auto-generation** — orc lays out the structure; tools like `typedoc` / `pydoc-markdown` / `swagger` fill `reference/api.md`. The skill is comfortable with auto-generated content as long as it's labeled.

## Iron rules in play

- **No AI attribution.** Docs read as if a human wrote them.
- **Insight blocks are conversation-only.** Don't insert `★ Insight ──...` blocks into doc files; that's Claude-vs-user space, not document content.
