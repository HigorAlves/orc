---
description: "Diagnose and fix a red CI run — dispatches orc-ci-investigator, then routes on its verdict: auto-fix via orc-code-fixer, flake re-run, infra escalation, or /orc:debug hand-off. Use when CI is red, PR checks fail, or after a push with --watch."
argument-hint: "[<pr-number>|<branch>] [--run <id>] [--watch]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh run:*)
  - Bash(gh pr checks:*)
  - Bash(gh pr view:*)
  - Bash(gh pr list:*)
  - Bash(git branch --show-current:*)
  - Bash(git log:*)
  - Bash(git push:*)
  - Bash(git status:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:ci

CI is red and you want to know why — and, when it's the code's fault, get it fixed without hand-reading 4,000 lines of logs. `/orc:ci` dispatches `orc-ci-investigator` for an evidence-cited diagnosis, then routes on the verdict: fix, re-run, escalate, or hand off to `/orc:debug`.

## Arguments

- `<pr-number>` or `<branch>` — optional ref. Omitted → the current branch (and its PR, if one exists).
- `--run <id>` — pin the investigation to an explicit run ID instead of resolving the newest run for the ref.
- `--watch` — after a push: poll `gh run watch <id>` (or `gh pr checks <pr> --watch`) until the run concludes, then run the normal flow if red. Green → report and exit.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection). `loose` context → surface and stop (no repo, no CI to inspect).

In workspace mode, read `${ORC_STATE_DIR}/orc.json` for the in-progress session's `linkedPRs`. With 2+ linked PRs and no explicit ref, `AskUserQuestion`: investigate all N / pick one / cancel. Iron rule: no silent broadcast. Each targeted PR gets its own investigator dispatch in Phase 2 (parallel, single response, multiple `Task` calls).

### Phase 1 — Resolve the ref + run

1. Resolution order: `--run <id>` wins; else the explicit `<pr-number>`/`<branch>` argument; else the current branch (`git branch --show-current`) and its PR via `gh pr list --head <branch>`.
2. `--watch`: run `gh run watch <id>` for the newest run on the ref (or `gh pr checks <pr> --watch` when the ref is a PR) and wait for the conclusion. Success → echo the green summary and stop. Failure → continue with that run pinned.
3. Without `--watch`: `gh run list --branch <branch> --limit 5` / `gh pr checks <pr>` for a quick read. Everything green → say so and stop — never manufacture work.
4. Initialize state: create `${ORC_STATE_DIR}/<sanitized-branch>/files/` if missing; append/update an entry in `.orc/orc.json` with `command: "ci"`, `status: in_progress`, `current_phase: 1`, `total_phases: 4`; write `checkpoint.md` with the resolved ref + run ID. (If an in-progress session already exists for this branch — e.g. a flow — append a `ci_status` line to its checkpoint instead of registering a duplicate.)

### Phase 2 — Dispatch the investigator

Dispatch `orc-ci-investigator` via `Task`. Pass:

- The resolved ref (PR number / branch) and pinned run ID when `--run` was given.
- The head SHA and a short diff summary (`git log -5 --oneline`) for drift correlation.
- **Workspace mode only**: `repo`, `repoPath` per targeted PR.

The agent returns the structured diagnosis (verdict + evidence table + fix list). Save it verbatim to `${ORC_STATE_DIR}/<branch>/files/ci-diagnosis.md`, bump checkpoint to phase 2.

### Phase 3 — Route on the verdict

#### `green`

Say so — one line, run ID cited. Mark the session `completed` and stop.

#### `fixable`

Preview the fix list, then gate:

```markdown
> **📋 Preview — CI fix list**
>
> <N> root cause(s) across <M> failed job(s). Applying clears the run.
```

```
1. <file>:<line> — <what to change> — clears <job(s)>
2. …
```

```markdown
> **⛔ Gate — apply CI fixes**
>
> orc-code-fixer applies the list above and re-runs the local suite.
```

`AskUserQuestion`:
- "Apply the fix list" — dispatch `orc-code-fixer` via `Task` with the fix list + diagnosis path. The agent applies edits, runs tests, returns a diff + test summary.
- "Edit the list first" — user trims/amends items, then dispatch.
- "This needs real debugging" — jump to the `needs-debug` route below.
- "Abort"

After a green fixer report, offer the landing step via `AskUserQuestion`:
- "Commit + push + re-watch" — invoke `orc:git-commit` (Conventional Commit from the diff), `git push`, then loop back to Phase 1 with `--watch` semantics until the run concludes.
- "Commit only — I'll push later"
- "Show me the diff first"

If the fixer report is red, return to Phase 2 with the new evidence (the investigator sees the failed attempt) — or offer the `needs-debug` hand-off.

#### `flake`

Re-print the agent's evidence (run-history lines proving intermittency), then `AskUserQuestion`:
- "Re-run failed jobs" — `gh run rerun <id> --failed`, then watch with `gh run watch <id>` and report the outcome.
- "Re-run everything" — `gh run rerun <id>`.
- "Not convinced — treat as fixable/needs-debug" — re-route.
- "Skip"

#### `infra`

No code changes to make. Surface the diagnosis + the agent's recommendation (pin the action version, report to the platform team, wait out the outage) with its evidence. Offer a re-run only when the agent recommended one.

#### `needs-debug`

The failure needs root-cause work beyond the diff. Hand off:

```markdown
> **➡️ Next**
>
> Genuine regression — run `/orc:debug` seeded with the CI diagnosis at `.orc/<branch>/files/ci-diagnosis.md`.
```

`AskUserQuestion`: "Start /orc:debug now (diagnosis pre-seeded as the bug description)" / "I'll run it later" / "Abort". On "now", invoke the `/orc:debug` workflow with the failing test name + diagnosis path as its input — its investigator starts from the CI evidence instead of zero.

### Phase 4 — Checkpoint

Update `checkpoint.md`: phase=done, verdict, run ID, fix commit SHA (if any), final CI conclusion (if re-watched). Mark the `.orc/orc.json` entry `completed` (or leave the parent flow session untouched when piggybacking).

## Iron rules

- **No fix without the investigator's diagnosis.** The fixer only ever receives an evidence-cited fix list — never "CI is red, go fix it".
- **Green is a valid answer.** Newest run passes → report and stop.
- **Re-runs are gated.** `gh run rerun` only after the flake evidence is shown and the user confirms.
- **Never `git push --force`** — a red pipeline is not a license for history rewrites.

## Output

- `.orc/<branch>/files/ci-diagnosis.md`
- Fix commit(s) on the branch (route `fixable`, per `orc:git-commit`)
- Checkpoint + registry entry (resumable via `/orc:resume`)
- Final one-line status: verdict, run ID, and what cleared (or who to call)
