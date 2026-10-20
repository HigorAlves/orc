<!-- orc:retro/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Present

1. Rank the candidates by severity, worst first.
2. Print one table: `#`, category, severity, one-line finding, where it lives.
3. Print each candidate's evidence and proposed change in a short block.
4. Write the same content to `${ORC_STATE_DIR}/<branch>/files/retro.md`.
5. Print a `⛔ Gate` callout (`orc:callouts`), then ask which candidates to act on now.
6. If the user selects none, skip orc:retro/P4 and close with `**➡️ Next**`.

Gate: soft-inward (`orc:gates` §4), `multiSelect`, default none. Group the options:

- *Apply in this repo* — a pointer, a lint rule, a CI job, a standards entry.
- *File for later* — anything bigger than one commit.

NOTE: `retro.md` lets `/orc:resume` and a later retro see the earlier proposals.
