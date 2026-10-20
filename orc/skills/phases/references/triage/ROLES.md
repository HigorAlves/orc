<!-- orc:triage/ROLES -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Triage roles

Roles are canonical names; the label strings come from `docs/agents/triage-labels.md`:

| Role | Kind | Meaning | For a PR |
|---|---|---|---|
| `bug` | category | something is broken | same |
| `enhancement` | category | new feature or improvement | same |
| `needs-triage` | state | the maintainer evaluates next | same |
| `needs-info` | state | waiting on the reporter | same |
| `ready-for-agent` | state | fully specified for an AFK agent | a brief exists; an agent works the diff next |
| `ready-for-human` | state | needs human implementation | ready for a human to merge |
| `wontfix` | state | not actioned | same |

Every triaged item carries exactly one category role and one state role.

## Transitions

- Unlabeled items move to `needs-triage`, then to `needs-info`, `ready-for-agent`, `ready-for-human` or `wontfix`.
- `needs-info` returns to `needs-triage` when the reporter replies.
- On conflicting state roles, flag it and ask the maintainer before anything else.
- The maintainer overrides any transition; flag unusual ones and ask.
