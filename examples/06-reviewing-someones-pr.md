# 06 — Reviewing someone's PR

## Scenario

A teammate opens PR #142 — "feat(billing): add proration on plan changes." 27 changed files, 480 lines added, 80 lines removed. You're the reviewer of record.

You could read every line yourself. orc lets you do it with discipline and far less rework.

## Flow

```
/orc:code-review 142 [--jira PROJ-1234] [--prd path/to/spec.md] [--context "..."]
       └─→ Eligibility check (closed? draft? already reviewed?)
              └─→ Project guidelines (CLAUDE.md scoped to changed files)
                     └─→ Requirements context (Jira/PRD/--context)
                            └─→ orc-pr-reviewer dispatched
                                   └─→ User confirms findings
                                          └─→ Submit as APPROVE / REQUEST_CHANGES / COMMENT
```

## Walk-through

### Phase 1 — Eligibility

`/orc:code-review` runs:

```bash
gh pr view 142 --json state,isDraft,reviewDecision,author,title,additions,deletions,changedFiles
```

If state is closed/merged: stop. If draft: ask `AskUserQuestion` whether to review anyway (sometimes drafts request early eyes). If you've already reviewed: stop and say so.

### Phase 2 — Gather project guidelines

```bash
# Walk the diff and find any CLAUDE.md scoped to changed directories
gh pr diff 142 --name-only | xargs -I {} dirname {} | sort -u | xargs -I {} find {} -name CLAUDE.md
```

These get passed to the reviewer agent as project-specific style/architecture rules.

### Phase 3 — Requirements context (optional)

If you passed `--jira PROJ-1234`: fetch the ticket via Jira MCP if available; otherwise tell you to provide context another way. If `--prd ./spec.md`: read it. If `--context "..."`: include verbatim.

This unlocks the **requirements-alignment** check inside the reviewer agent — does the PR actually do what was asked?

### Phase 4 — Dispatch the reviewer

`Task` dispatches `orc-pr-reviewer` (model: opus). The agent gets:

- `gh pr view 142 --json ...` output
- `gh pr diff 142` output
- CLAUDE.md content found in step 2
- Requirements text from step 3

The agent walks every changed file, looks for **real bugs** (logic errors, null derefs, off-by-one, race conditions, wrong operators), security issues, missing tests for non-trivial new behavior, inconsistencies (one call site updated, another forgotten), guideline violations.

It explicitly does NOT flag:

- style / formatting (linter's job)
- "I would have done it differently"
- pre-existing bugs not touched by the diff
- hypothetical futures

**Confidence rule:** if <80% sure a finding is real, it's dropped. False positives are worse than misses for trust.

### Phase 5 — Confidence-graded output

The agent returns categorized findings using `orc:caveman-review` discipline (one line per finding, file:line format):

```
## Bugs
- src/billing/proration.ts:47 — off-by-one: range stops at <, should be <= for inclusive end-of-cycle — fix: `<= cycleEnd`
- src/billing/proration.ts:88 — null deref when previous_invoice is undefined for first-month users — guard with optional chaining

## Security
(none)

## Tests
- src/billing/proration.ts:55–80 — refund-edge-case branch untested — add test for "user downgrades on the last day of cycle"

## Architecture
- src/api/billing.ts:120 — endpoint reaches into BillingService internals (formerly private) — re-expose a clean method or move the call inside

## Nits
(none — flagged only on explicit request)
```

If nothing's actionable: "No actionable issues. Approve."

### Phase 6 — Confirm

`AskUserQuestion`:

- "Submit as REQUEST_CHANGES with these comments"
- "Submit as APPROVE — looks good"
- "Submit as COMMENT — for discussion only"
- "Hold — let me edit findings first"

### Phase 7 — Submit

If user confirms a non-pending submission:

```bash
gh pr review 142 --request-changes --body "<summary>"
# Then for each inline finding:
gh api repos/{owner}/{repo}/pulls/142/comments \
  -f body="<finding>" \
  -f path="<file>" \
  -f line=<line> \
  -f side="RIGHT"
```

Or use the GitHub MCP `add_comment_to_pending_review` if available — same effect.

## Artifacts

`/orc:code-review` is **stateless from orc's perspective** — no `.orc/` writes. The artifact lives on GitHub (the submitted review). Discussion happens in the PR.

## Done when

- The review is submitted (APPROVE / REQUEST_CHANGES / COMMENT).
- Inline comments are at the right files and lines.
- No false positives — every comment is an action-enabling finding.

## Tone & rules (handed to the agent)

- One line per finding: `<file>:<line> — <problem> — <fix>`.
- No "consider", "perhaps", "great work."
- No praise, no hedge.
- False positives erode trust faster than misses — drop borderline findings.
- Reviews on AI-generated PRs are still required; the AI doesn't get a free pass.

## Variants

- **PR is too big to review in one shot** — comment that the PR should be split, then APPROVE the trivial portion or REQUEST_CHANGES on the structural pieces. Don't pretend to review 60 files in one read.
- **You disagree with a guideline the reviewer agent flagged** — override in the confirmation step. Add a comment to the doc/CLAUDE.md if the rule itself needs revision.
- **You want to do a "vibes" review without the agent** — fine, but you lose the systematic guideline + bug + security + tests + requirements pass. Use the agent for the systematic pass and add your "vibes" reading on top.

## Iron rules in play

- **No AI attribution.** Reviews read as your voice. The agent is the lens, you are the reviewer.
- **No false positives.** The agent's confidence rule + the user-confirm step both guard this.
- **Insight blocks are not for PR comments.** Save the `★ Insight ─────` format for conversations, not GitHub threads — those need to read as engineer-to-engineer.
