---
description: Review someone else's open GitHub PR — posts a real review with line-anchored inline comments; verdict computed mechanically; mandatory preview gate. Workspace-aware. For your OWN working diff, prefer the bundled /code-review instead.
argument-hint: "<pr-number-or-url> [--prs a#1,b#2,...] [--context <description>] [--summary-only] [--soft-tests] [--dry-run] [--include-nits] [--audit]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr list:*)
  - Bash(gh issue view:*)
  - Bash(gh api:*)
  - Bash(command -v gitleaks:*)
  - Bash(gitleaks:*)
  - Bash(gh api repos:*/pulls:*/reviews:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
effort: high
---

# /orc:code-review

Review a pull request someone else authored. Post a real GitHub review: inline comments anchored to changed lines, one-click suggestion blocks, and an event computed from finding severities.

`orc-pr-reviewer` and `orc-security-reviewer` return JSON findings. This command merges them, checks verdict against severity, previews, then posts via `gh api` or the GitHub MCP.

## Arguments

- `<pr-number-or-url>` — required unless `--prs` is given: `123`, `org/repo#123`, or a URL.
- `--prs a#1,b#2,...` — workspace mode: review linked PRs as one change. Excludes the positional ref.
- `--context <description>` — what the PR is meant to do; feeds spec-conformance findings.
- `--summary-only` — print a markdown summary instead of posting. Skips P5–P6.
- `--soft-tests` — `test` findings become COMMENT instead of REQUEST_CHANGES.
- `--dry-run` — run through the preview, print the payload as JSON, post nothing.
- `--include-nits` — keep `nit` findings (default: drop them). Never changes the event.
- `--audit` — repo-wide security audit, no PR. See the Audit module.

## Preconditions

> **🛑 Outward write**
>
> P6 posts to GitHub. The preview gate before it is hard-outward: no flag and no autopilot level skips it.

- `--audit` excludes the positional ref, `--prs`, `--soft-tests` and `--dry-run`.
- A bad ref or an empty diff stops the run in P1, never inside a sub-agent.

## Phases

Modules live in `orc:phases` (`references/code-review/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Scope: eligibility, diff, standards, spec | `orc:code-review/P1` | `--audit` |
| 3 Dispatch reviewers | `orc:code-review/P3` | `--audit` |
| 4 Merge and compute the event | `orc:code-review/P4` | `--audit` |
| 5 Compose the review | `orc:code-review/P5` | `--summary-only`, `--audit` |
| 6 Preview gate, then post | `orc:code-review/P6` | `--summary-only`, `--audit` |
| 8 Summary-only output | `orc:code-review/P8` | posted in P6 |
| Audit | `orc:code-review/AUDIT` | not `--audit` |

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

1. Read the banner above; `ORC_*` vars are exported. Do not re-run detection.
2. If `--audit`, Read the Audit module and stop here.
3. Decide single-PR or multi-PR: `--prs` given, or an in-progress session's `linkedPRs` matches the ref.
4. In multi-PR mode, resolve the full PR set before P1.

NOTE: multi-PR mode reviews each PR with its own `orc-pr-reviewer` instance, tags findings `[repo:<name>]`, and posts to each PR independently (orc:code-review/P3, P6).

## Iron rules

- The event is computed from severities (`orc:review-contract`). Agents never decide it.
- The preview gate is mandatory. No flag bypasses it.
- At most 15 inline comments; the overflow is the user's choice to drop.
- Comment only on lines the PR modified.
- Suggestion blocks follow `orc:inline-review`: at most 6 lines, complete, valid.
- No AI attribution in the review body or any comment.

## Output

- A GitHub PR review with inline comments and the computed event, or a markdown summary.
- The review URL, when posted.
- `${ORC_STATE_DIR}/<branch>/files/review-findings.json`, written in P4 for resume.
