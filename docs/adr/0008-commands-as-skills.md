# 0008 — Commands stay flat files; large ones pilot as skill directories

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** maintainer

## Context

The Claude Code plugin docs say commands are the older format and skills supersede them for new work; a skill directory can carry supporting files, a command is one flat Markdown file. orc has 32 commands under `orc/commands/`, several over 10 KB, and the authoring standard (ADR 0007) caps a command entry at 6 KB with phases disclosed as modules. Because a command cannot own a `references/` directory, those modules live in a shared skill, `orc:phases`, under `references/<command>/`.

Migrating every command to a skill directory would change the counts CI checks, the router, the docs catalog, every `orc:<name>` cross-reference and the `/orc:` namespace rules, in one step, without evidence that routing or behaviour improves.

## Decision

Commands remain flat files under `orc/commands/` and their phase modules live in `orc:phases`. Three of the largest commands (`code-review`, `cleanup`, `incident`) are piloted as skill directories with `disable-model-invocation: true` and their modules under their own `references/`, in the same train that lands this ADR. The pilot decides the rest: if the three behave identically in the eval suite and the entry files read better with modules beside them, the remaining commands migrate one train at a time; if not, the three move back and `orc:phases` stays the home for modules.

New surfaces are written as skill directories from now on, never as commands.

## Alternatives considered

### Option A — Migrate all 32 now
- Rejected: the largest mechanical change in orc's history with no measurement behind it.

### Option B — Never migrate
- Rejected: the docs are explicit that commands are legacy; waiting until they stop loading is worse than a measured move.

## Consequences

- **Positive:** modules can sit beside the entry they belong to; new surfaces follow the current format; the decision is reversible per command.
- **Negative:** a mixed state during the pilot: `verify-counts.sh`, `verify-refs.sh` and the router check have to treat a user-invoked skill directory as a command for counting and routing.
- **Neutral:** `/orc:<name>` keeps working either way; the namespace is shared.

## Follow-ups

- [ ] Pilot the three in the precision train; record eval results for each.
- [ ] Decide the remaining 29 from the pilot, one train at a time.
