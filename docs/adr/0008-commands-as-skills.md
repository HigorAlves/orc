# 0008 — Commands stay flat files; large ones pilot as skill directories

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** maintainer

## Context

The Claude Code plugin docs say commands are the older format and skills supersede them for new work; a skill directory can carry supporting files, a command is one flat Markdown file. orc had 32 commands under `orc/commands/` when this was written, several over 10 KB, and the authoring standard (ADR 0007) caps a command entry at 6 KB with phases disclosed as modules. Because a command cannot own a `references/` directory, those modules live in a shared skill, `orc:phases`, under `references/<command>/`.

Migrating every command to a skill directory would change the counts CI checks, the router, the docs catalog, every `orc:<name>` cross-reference and the `/orc:` namespace rules, in one step, without evidence that routing or behaviour improves.

## Decision

Commands remain flat files under `orc/commands/` and their phase modules live in `orc:phases`. Three of the largest commands (`code-review`, `cleanup`, `incident`) are piloted as skill directories with their modules under their own `references/`, in the same train that lands this ADR. They stay model-invocable, because orc's routing evals reach surfaces through the model; `cleanup` keeps the `disable-model-invocation: true` it already carried as a command (it is destructive and user-driven). The pilot decides the rest: if the three behave identically in the eval suite and the entry files read better with modules beside them, the remaining commands migrate one train at a time; if not, the three move back and `orc:phases` stays the home for modules.

New surfaces are written as skill directories from now on, never as commands.

## Alternatives considered

### Option A — Migrate all 32 now
- Rejected: the largest mechanical change in orc's history with no measurement behind it.

### Option B — Never migrate
- Rejected: the docs are explicit that commands are legacy; waiting until they stop loading is worse than a measured move.

## Consequences

- **Positive:** modules can sit beside the entry they belong to; new surfaces follow the current format; the decision is reversible per command.
- **Negative:** a mixed state during the pilot. Counts are by file location: README and the marketplace say 29 commands (flat files under `orc/commands/`) and 87 skills (directories, the three pilots included), while 32 `/orc:` surfaces exist; `docs/commands.md` says so under its table. The router check covers flat files; the three pilots are listed in `orc:map` by hand.
- **Neutral:** `/orc:<name>` keeps working either way; the namespace is shared.

## Follow-ups

- [ ] Pilot the three in the precision train; record eval results for each.
- [ ] Decide the remaining 29 from the pilot, one train at a time.
