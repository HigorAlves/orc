---
description: Clean up after completed or abandoned orc sessions — removes workspace state, registry entry, git worktree, and optionally the merged branch. Destructive; always previews and asks first. Workspace-aware.
argument-hint: "[--auto[=guided|full]] [--dry-run] [--all-completed] [--per-repo] [--down-volumes] [<session-id-or-branch>]"
disable-model-invocation: true
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git worktree:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(gh pr view:*)
  - Bash(rm -rf .orc:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
  - Bash(orc-docker-env:*)
  - Bash(docker compose:*)
  - Bash(kill:*)
  - Bash(ps:*)
---

# /orc:cleanup

Close the loop on finished orc work: remove the workspace state, the worktree and, when safe, the local feature branch.

## Arguments

- `--auto[=guided|full]` — autopilot level for this run; overrides `interaction_policy`. Ladder and hard-outward exemption: `orc:gates` §6.
- `<session-id-or-branch>` — optional. Clean exactly one session, by `sessionId` (`orc-state sessions`, schema `orc:state-protocol`) or branch name, sanitized or raw.
- `--all-completed` — clean every session whose `status` is `completed` or `abandoned`. Every safety check still applies per session.
- `--dry-run` — print what would happen; change nothing. Recommended for the first run.
- `--per-repo` — workspace mode: clean each linked repo as its PR merges. Use only when abandoning some repos (rare).
- `--down-volumes` — also remove a torn-down environment's named volumes. Default keeps them: the next boot reuses DB data.

NOTE: at `guided` or `full`, the standard plan (state dir, clean worktree, merged branch) auto-applies after printing. Anomalies still gate at every level: partial workspace merges, unmerged branches, a dirty worktree.

## Preconditions

> **🛑 Destructive run**
>
> P6 removes state directories, worktrees and local branches. The P5 preview gate is mandatory; `--dry-run` never applies.

- Running from inside a candidate worktree stops the run in P1: `cd` to the main repo first.
- In workspace mode, an open linked PR refuses the run unless `--per-repo` or the session is `abandoned`.
- Typical moments: a shipped PR merged; `/orc:status` shows stale `completed` sessions; an abandoned feature (mark the session `abandoned` first).

## Phases

Modules live in `orc:phases` (`references/cleanup/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Guard: not inside a candidate | `orc:cleanup/P1` | never |
| 2 Read the registry | `orc:cleanup/P2` | never |
| 3 Build the candidate list | `orc:cleanup/P3` | never |
| 4 Inspect each candidate | `orc:cleanup/P4` | never |
| 5 Preview the plan, then confirm | `orc:cleanup/P5` | never; `--dry-run` stops here |
| 6 Apply with safety gates | `orc:cleanup/P6` | `--dry-run`, Cancel |
| 7 Report | `orc:cleanup/P7` | `--dry-run` |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; it exports `ORC_*` vars. Do not re-run detection.
2. In workspace mode, note the registry for P2: `${ORC_STATE_DIR}/orc.json`.
3. In workspace mode, before P4, fetch the merge state of each candidate's linked PRs.
4. If any linked PR is not `MERGED`, refuse and list the open PRs.

```bash
for url in $(jq -r '.sessions[] | select(.sessionId == "'$ID'") | .linkedPRs[].url' "$ORC_STATE_DIR/orc.json"); do
  gh pr view "$url" --json state -q .state
done
```

NOTE: workspace sessions carry `scope: "workspace"` and a `repos` array. After a refusal the user either waits, passes `--per-repo` to clean only the merged repos, or marks the session `abandoned` to bypass the merge check.

## Iron rules

- Never pass `--force` to `git worktree remove`. A dirty worktree holds user work: skip it and say so.
- Never run `git branch -D`. Only `-d`, which refuses unmerged branches. The user runs `-D` by hand.
- Never delete while running from inside a candidate. Refuse and name where to `cd`.
- `.orc/orc.json` updates are atomic: Read, modify in memory, Write the whole file. Never partial.
- `--dry-run` always prints the plan and exits, even after a confirming answer in the gate.
- A stack member at position N is deletable only when positions 1..N-1 are all `MERGED`. `--per-repo` bypasses, with consent.
- Never `docker compose down` a project without the `orc-` prefix. Orphans appear in the preview; the user opts into each one.
- Named volumes survive by default; only `--down-volumes` removes them. DB data is user work.

## Output

- `.orc/orc.json` with the cleaned entries removed.
- `.orc/<branch>/` directories removed.
- Worktrees removed where clean; local branches deleted where merged.
- A plain fenced summary (P7) with everything left undone and why.
