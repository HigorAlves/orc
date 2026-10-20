<!-- orc:plan/REFACTOR -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Refactor-shaped input (before P1)

Runs when the user asks to refactor, restructure, pay down tech debt or improve architecture, or when `--type=refactor` arrived (e.g. from `/orc:flow`).

1. Dispatch the `orc-refactor-architect` subagent via `Task`.
2. Pass it the request plus any named modules or paths.
3. Print the Gate headline below, then ask with `AskUserQuestion`.
4. List the ranked candidates as options, plus "Different scope — describe it".
5. Take the chosen candidate as the scope `orc:plan/P2` drafts around.
6. Continue to `orc:plan/P1`.

Gate headline (`orc:callouts`): `**⛔ Gate — refactor candidates**`, then one line on the candidate count and the top leverage pick.

NOTE: the architect compares documented intent (ADRs, `GLOSSARY.md`) against the implementation and returns leverage-ranked refactor candidates with cost-versus-friction estimates. This pre-phase and `orc:plan/PRD` are exclusive.
