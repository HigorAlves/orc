---
description: "Diagnose and fix a red CI run — dispatches orc-ci-investigator, then routes on its verdict: auto-fix via orc-code-fixer, flake re-run, infra escalation, or /orc:debug hand-off. Use when CI is red, PR checks fail, or after a push with --watch."
argument-hint: "[<pr-number>|<branch>] [--run <id>] [--watch]"
allowed-tools:
  - Bash(orc-state:*)
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
4. Register state: `orc-state init --command ci --total-phases 4`, then record the resolved ref + run ID via `orc-state digest write -`. Defer to `orc:state-protocol` for schema and rules. (If an in-progress session already exists for this branch — e.g. a flow — do NOT re-init as `ci`; append a `ci_status` line to that session's checkpoint body instead.)

### Phase 2 — Dispatch the investigator

Dispatch `orc-ci-investigator` via `Task`. Pass:

- The resolved ref (PR number / branch) and pinned run ID when `--run` was given.
- The head SHA and a short diff summary (`git log -5 --oneline`) for drift correlation.
- **Workspace mode only**: `repo`, `repoPath` per targeted PR.

The agent returns the structured diagnosis (verdict + evidence table + fix list). Save it verbatim to `${ORC_STATE_DIR}/<branch>/files/ci-diagnosis.md`, bump checkpoint to phase 2.

### Phase 3 — Route on the verdict

Invoke **`orc:ci-routing`** and execute its protocol: the single-render rule (diagnosis saved via Write, ONE capped preview, 3-line evidence quotes), the `fixable` one-call apply+landing gate, and the `flake` / `infra` / `needs-debug` routes. The skill is the single source of truth shared with `/orc:flow`'s post-open CI gate.

### Phase 4 — Checkpoint

Update `checkpoint.md`: phase=done, verdict, run ID, fix commit SHA (if any), final CI conclusion (if re-watched). Mark the `.orc/orc.json` entry `completed` (or leave the parent flow session untouched when piggybacking).

## Iron rules

- **Green is a valid answer.** Newest run passes → report and stop — never manufacture work.
- The routing iron rules (no fix without the diagnosis, gated re-runs, never force-push) live in `orc:ci-routing` — they apply verbatim here.

## Output

- `.orc/<branch>/files/ci-diagnosis.md`
- Fix commit(s) on the branch (route `fixable`, per `orc:git-commit`)
- Checkpoint + registry entry (resumable via `/orc:resume`)
- Final one-line status: verdict, run ID, and what cleared (or who to call)
