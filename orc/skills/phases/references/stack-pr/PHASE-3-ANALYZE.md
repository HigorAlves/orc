<!-- orc:stack-pr/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Analyze (commit-based, default)

1. If `--smart`, Read `orc:stack-pr/SMART` instead of this phase.
2. Validate every commit subject against the Conventional Commits regex (`orc:stack-pr` skill).
3. On any miss, ask with `AskUserQuestion` using the options below.
4. On "Reword", rewrite each failing subject non-interactively, one prompt per commit.
5. On "Switch to `--smart`", Read `orc:stack-pr/SMART`.
6. On "Cancel", stop.
7. Build the slice list: one slice per commit.
8. Compute each slice's `est_loc` from the per-commit numstat sum.

`AskUserQuestion` options:

1. **Reword** — non-interactive subject rewrite, one prompt per commit.
2. **Switch to `--smart`** — the agent does not care about subjects.
3. **Cancel.**

NOTE: `est_loc` simulates `git diff --shortstat <prev>...<this>` by summing per-commit numstat.
