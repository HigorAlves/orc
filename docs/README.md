# orc docs

One page per question. Pick the row that matches yours.

## Start

| You want to… | Read |
|---|---|
| Install orc and verify it works | [install.md](install.md) |
| See what a day with orc looks like | [examples/README.md](examples/README.md), nineteen scenarios |
| Check it is safe to run on your machine | [safety.md](safety.md) |

## Use

| You want to… | Read |
|---|---|
| Find the command for a situation | [commands.md](commands.md), or `/orc:map` inside Claude Code |
| Tune settings, environment variables, the statusline | [configuration.md](configuration.md) |
| Understand gates, autopilot, sessions and `.orc/` state | [architecture.md](architecture.md) |
| Learn the words orc's files use | [../GLOSSARY.md](../GLOSSARY.md) |

## Operate

| You want to… | Read |
|---|---|
| Run orc from a parent directory of several repos | [architecture.md](architecture.md) (workspace mode) and the `orc:workspace-mode` skill |
| Point browser QA at staging or a preview | the `orc:qa-targets` skill; [examples/18](examples/18-playwright-qa-and-explainer.md) |
| Fix red CI, cut a release, audit dependencies, run an incident | [examples/13](examples/13-fixing-red-ci.md), [16](examples/16-cutting-a-release.md), [15](examples/15-dependency-audit.md), [14](examples/14-live-incident.md) |

## Contribute

| You want to… | Read |
|---|---|
| Add or change a skill, command, agent or hook | [contributing.md](contributing.md) |
| Write it the way orc's files are written | the authoring standard: [`orc/skills/skill-writing/references/AUTHORING-STANDARD.md`](../orc/skills/skill-writing/references/AUTHORING-STANDARD.md) |
| Know what is accepted and what was already rejected | [../SCOPE.md](../SCOPE.md), [agents/out-of-scope.md](agents/out-of-scope.md) |
| Release a version | [contributing.md](contributing.md#releasing), [../CHANGELOG.md](../CHANGELOG.md) |

## Decide

Architecture Decision Records in [adr/](adr): why PRs are never chained, why the mod sits over the bash hooks, why releases use two tag namespaces, why output is terse by default, why punctuation is what it is, why gates use `AskUserQuestion`, the controlled-language standard, and commands versus skill directories.

## For the agent

`agents/` holds the tracker layer `/orc:setup` wrote for this repo (issue tracker, triage labels, domain docs) and the out-of-scope knowledge base that `/orc:triage` reads. Those files are read by orc, not by people, and follow the authoring standard.
