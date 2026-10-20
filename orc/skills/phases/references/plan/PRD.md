<!-- orc:plan/PRD -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# PRD-shaped input (before P1)

Runs when the feature description is long-form, references a Jira ticket or linked doc, or reads like a brief.

1. Dispatch the `orc-prd-analyzer` subagent via `Task`.
2. Pass it the input and the URL, when there is one.
3. Print the Gate headline below, then ask with `AskUserQuestion`.
4. On "Proceed", continue to `orc:plan/P1`.
5. On "Hold", exit; planning effort waits for the P0 answers.
6. On "Run `/orc:rfc` first", exit and hand off to `/orc:rfc`.

Gate headline (`orc:callouts`): `**⛔ Gate — PRD analysis**`, then one line on the P0/P1/P2 counts.

`AskUserQuestion` options:

- "Proceed to plan — questions are P1/P2 only"
- "Hold — answer P0 questions with PM first"
- "Run `/orc:rfc` first — design space needs RFC treatment"

NOTE: the analyzer returns a structured analysis: extracted goals, ambiguities, P0/P1/P2 clarifying questions, a recommendation. This pre-phase and `orc:plan/REFACTOR` are exclusive.
