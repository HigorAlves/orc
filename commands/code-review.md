---
description: Review someone else's open GitHub PR end-to-end via gh CLI. Returns a terse, signal-only comment list using the orc-pr-reviewer subagent.
argument-hint: "<pr-number-or-url> [--context <description>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Skill
  - Task
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr list:*)
  - Bash(gh api:*)
---

# /orc:code-review

Review a pull request authored by someone else. Output is a terse, signal-only review modeled on `orc:caveman-review`. No filler, no praise.

## Arguments

- `<pr-number-or-url>` — required. Either `123` (current repo), `org/repo#123`, or a full URL.
- `--context <description>` — optional. Describes what the PR is supposed to accomplish, used for requirements-alignment checks.

## Workflow

### Phase 1 — Eligibility check

- `gh pr view <ref> --json state,isDraft,reviewDecision,author,title,additions,deletions,changedFiles`
- If `state` is closed or merged, stop.
- If `isDraft` is true, ask the user via `AskUserQuestion` whether to review anyway (sometimes drafts are explicitly opened for early feedback).
- If `reviewDecision` shows the user has already reviewed, stop and report.

### Phase 2 — Project guidelines

`Glob` the repo for `CLAUDE.md` files (root + scoped to changed directories). Read them. The reviewer agent will use them as project-specific style/architecture rules.

### Phase 3 — Dispatch reviewer

Dispatch the `orc-pr-reviewer` subagent via `Task`. Pass it:
- The PR ref.
- The full diff (`gh pr diff <ref>`).
- Any CLAUDE.md guideline content found.
- Any `--context` text.

The agent returns a categorized finding list (Bugs / Security / Tests / Architecture / optional Nits).

### Phase 4 — Confirm with user

Show the finding list. Use `AskUserQuestion`:
- "Submit as REQUEST_CHANGES with these comments"
- "Submit as APPROVE — looks good"
- "Submit as COMMENT — for discussion only"
- "Hold — let me edit findings first"

### Phase 5 — Submit (if approved)

Use `gh pr review <ref> --request-changes/--approve/--comment --body "<summary>"` and `gh api repos/.../pulls/<n>/comments` to post inline comments at the right files/lines.

## Output

- A markdown review summary echoed to the user.
- The submitted review on GitHub (if user approved).
- (No `.orc/` writes — code review is stateless from orc's perspective.)

## Tone discipline (handed to the agent)

- One line per finding.
- File:line — problem — fix.
- No "consider", no "perhaps", no "great work."
- False positives are worse than misses; if <80% sure, drop it.
