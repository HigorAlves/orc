---
name: skill-writing
description: Create new agent skills following orc's house conventions and CI gates. Use when creating, writing, or building a skill for THIS plugin. For skill evals, trigger-rate measurement, and description tuning, use the official skill-creator plugin.
---

# Write a Skill

House conventions for skills in THIS plugin. The general doctrine of writing for agents — context pointers, the two loads, information hierarchy, completion criteria, leading words, pruning, invocation choice — lives in `orc:writing-for-agents` (and its [SKILL-MECHANICS.md](../writing-for-agents/references/SKILL-MECHANICS.md) for skill frontmatter mechanics and invocation choice). Read that first; this file adds only what is orc-specific.

## Naming

- Directory and `name` frontmatter must match exactly: kebab-case, ≤64 chars (`verify-frontmatter.sh` enforces this).
- The `orc:<name>` namespace is shared between commands (`orc/commands/*.md`) and skills (`orc/skills/*/`). Before naming a skill, check both registers — a collision silently shadows one of the two.
- Agents are `orc-` prefixed (`orc/agents/orc-*.md`); skills and commands are not.

## Description as trigger

The description is the skill's always-loaded context pointer — write it per `orc:writing-for-agents`, plus these house rules:

- ≤1024 chars, single line, third person.
- First sentence: what the skill does. Second sentence: "Use when [specific triggers]".
- Cross-skill prose mentions use the `orc:<name>` form; only reference skills that actually exist in `orc/skills/` (CI checks this).

## The YAML colon-space trap

Descriptions are single-line YAML scalars. An unquoted value containing colon-space (`: `) silently kills the whole frontmatter block — the skill loads with no metadata and never fires. Wrap the value in double quotes whenever it contains colon-space. Em-dashes are the house-preferred separator precisely because they dodge this.

## Layout: progressive disclosure with references/

```
orc/skills/skill-name/
├── SKILL.md           # the top: steps + inline reference every branch needs
└── references/        # disclosed reference, reached by pointers from SKILL.md
    └── TOPIC.md
```

- Disclosed files live under `references/`, UPPERCASE names, linked as `[<TOPIC>.md](references/<TOPIC>.md)`.
- Cross-skill file links are relative: `../<other-skill>/references/<TOPIC>.md`. Every concrete link must resolve on disk (CI checks this).
- Scripts (when an operation is deterministic) go in `scripts/` beside `references/`.

## Provenance frontmatter for vendored skills

Skills vendored or derived from an external source carry provenance in frontmatter:

```yaml
license: MIT
metadata:
  author: Matt Pocock
  source: Vendored from https://github.com/mattpocock/skills @ 2ffb184
```

Use `Vendored from … @ <pin>` for near-verbatim copies and `Derived from …` for forks that diverge. If a later merge adds material from a second upstream, extend `source` to name both.

## CI gates a new skill must pass

Run from the repo root before shipping:

1. `scripts/ci/verify-frontmatter.sh` — name/dir match, kebab-case, description present and ≤1024 chars.
2. `scripts/ci/verify-refs.sh` — every `orc:<name>` mention, `references/*.md` link, relative `../<skill>/…` link, and agent `skills:` entry resolves.
3. `scripts/ci/verify-counts.sh` — README, marketplace.json, and docs/architecture.md counts; adding a skill changes the skill count, so update the prose these check.
4. `claude plugin validate ./orc --strict` — the strict plugin validation CI runs. Beware: validate can mask non-zero exit codes when chained; run it as its own command and check `$?` directly.
