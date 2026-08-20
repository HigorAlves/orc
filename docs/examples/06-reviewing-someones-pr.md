# 06 — Reviewing someone's PR

## Scenario

A teammate opens PR #142 — "feat(billing): add proration on plan changes." 27 changed files, 480 lines added, 80 lines removed. You're the reviewer of record.

You could read every line yourself. orc lets you do it with discipline and far less rework — and posts real GitHub inline comments anchored to the right lines, not a markdown wall the author has to manually navigate.

## Flow

```mermaid
flowchart TD
    cmd["/orc:code-review 142<br/>[--context | --summary-only | --soft-tests | --dry-run | --audit]"]
    elig[Phase 1: Eligibility check<br/><i>bad ref? closed? draft? already reviewed?</i>]
    guide[Phase 2: Diff + guidelines + spec<br/><i>fail fast on empty diff;<br/>CLAUDE.md + originating issue fetched</i>]
    rev[Phase 3: agents dispatched<br/><i>orc-pr-reviewer + orc-security-reviewer (parallel)</i><br/><b>return structured JSON findings</b>]
    merge[Phase 4: merge + sanity check<br/><i>compute event from severities;<br/>flag agent self-contradictions</i>]
    compose[Phase 5: compose review payload<br/><i>overall body + comments array;<br/>cap at 15</i>]
    preview[Phase 6: preview gate<br/><i>AskUserQuestion: post / edit / summary-only / cancel</i>]
    post[Phase 7: post via gh api or GitHub MCP<br/><i>real inline comments + computed event</i>]

    cmd --> elig --> guide --> rev --> merge --> compose --> preview --> post
```

## Walk-through

### Phase 1 — Eligibility

`/orc:code-review` runs:

```bash
gh pr view 142 --json state,isDraft,reviewDecision,author,title,additions,deletions,changedFiles
```

If the ref doesn't resolve at all (bad number, wrong repo, typo'd URL): fail fast right here with the exact `gh` error — a bad ref never reaches the parallel sub-agents. If state is closed/merged: stop. If draft: ask `AskUserQuestion` whether to review anyway (sometimes drafts request early eyes). If you've already reviewed: stop and say so.

### Phase 2 — Gather project guidelines

```bash
# Walk the diff and find any CLAUDE.md scoped to changed directories
gh pr diff 142 --name-only | xargs -I {} dirname {} | sort -u | xargs -I {} find {} -name CLAUDE.md
```

These get passed to the reviewer agent as project-specific style/architecture rules.

Two more things happen in this phase: an **empty diff fails fast** (0 hunks → stop; agents are never dispatched against nothing), and the PR body + commit messages are scanned for an originating issue/spec reference (`#123`, `Closes #45`, a full issue URL, a Jira key in the branch/title). If found, the issue is fetched via `gh issue view` (or `gh api` cross-repo).

### Phase 3 — Requirements context (optional)

If Phase 2 found an originating issue/spec, it rides along to `orc-pr-reviewer` automatically — that's what makes **spec-conformance** findings (missing acceptance criteria, scope creep) possible. No reference found? Pass `--context "..."` to describe what the PR is supposed to accomplish.

Either way, this unlocks the **requirements-alignment** check inside the reviewer agent — does the PR actually do what was asked?

### Phase 4 — Dispatch the reviewer(s)

`Task` always dispatches `orc-pr-reviewer` (model: sonnet, generalist).

When the diff touches security-sensitive paths (auth, sessions, raw SQL, deserialization, file upload, request parsing, dependency surface), `orc-security-reviewer` is dispatched **in parallel**. Auto-detected from the changed-file list; the user can force-on or force-off via `AskUserQuestion`.

Each agent gets:

- `gh pr view 142 --json ...` output
- `gh pr diff 142` output
- CLAUDE.md content found in step 2
- Requirements text from step 3 (the fetched issue/spec goes to `orc-pr-reviewer`)

`orc-pr-reviewer` walks every changed file, looks for **real bugs** (logic errors, null derefs, off-by-one, race conditions, wrong operators), missing tests for non-trivial new behavior, inconsistencies (one call site updated, another forgotten), guideline violations.

`orc-security-reviewer` (when dispatched) does a focused security pass: injection (SQL/cmd/template), auth/authz bypass, secret exposure, unsafe deserialization, SSRF/CSRF, insecure crypto, dependency CVEs. Each finding includes a concrete exploit scenario.

It explicitly does NOT flag:

- style / formatting (linter's job)
- "I would have done it differently"
- pre-existing bugs not touched by the diff
- hypothetical futures

**Confidence rule:** if <80% sure a finding is real, it's dropped. False positives are worse than misses for trust.

### Phase 5 — Structured JSON findings + merge

Each agent returns **strict JSON** (per the `orc:review-contract` schema — both reviewer agents preload that skill, which also owns the severity vocabulary and the severity→event rule), not markdown. Excerpt of `orc-pr-reviewer`'s output:

```json
{
  "summary": "Adds proration on plan changes. Looks reasonable but has 2 real bugs in the proration math and an untested edge case at the cycle boundary.",
  "findings": [
    {
      "path": "src/billing/proration.ts",
      "line": 47,
      "severity": "bug",
      "title": "Off-by-one: range stops short of cycleEnd",
      "body": "`for (let d = cycleStart; d < cycleEnd; d++)` excludes the final day of the cycle. Last day's proration is missing.",
      "suggestion_code": "for (let d = cycleStart; d <= cycleEnd; d++) {",
      "confidence": 0.93
    },
    {
      "path": "src/billing/proration.ts",
      "line": 88,
      "severity": "bug",
      "title": "Null deref on first-month users",
      "body": "`previous_invoice` is undefined for users on their first month. The next line dereferences `.amount`. Guard with optional chaining or early return.",
      "suggestion_code": "const prev = invoice.previous_invoice?.amount ?? 0;",
      "confidence": 0.91
    },
    {
      "path": "src/billing/proration.ts",
      "line": 80,
      "start_line": 55,
      "severity": "test",
      "title": "Cycle-boundary downgrade branch untested",
      "body": "No test for `user downgrades on the last day of the cycle`. Add a test asserting the partial-credit calculation handles the boundary case.",
      "suggestion_code": null,
      "confidence": 0.85
    },
    {
      "path": "src/api/billing.ts",
      "line": 120,
      "severity": "api-surface",
      "title": "Endpoint reaches into BillingService internals",
      "body": "`req.body` flows into `BillingService['_internalMethod']` (was private; this PR exposes it via bracket access). Re-expose a clean method or move the call inside the service.",
      "suggestion_code": null,
      "confidence": 0.82
    }
  ]
}
```

`/orc:code-review` Phase 4 merges this with `orc-security-reviewer`'s output (which here returned `findings: []`), validates each finding's `path:line` is in the diff, drops `confidence < 0.8`, and **computes the review event mechanically**:

```
findings include severity ∈ {bug, security, api-surface}
  → event = REQUEST_CHANGES
```

The agent's `summary` ("looks reasonable") is informational only; the severity rule overrides any verdict it implies. If the agent had written *"Approve, looks good"* the orchestrator would surface a contradiction warning at the preview gate (see below).

Before the gate, the merged findings + computed event persist to `.orc/<branch>/files/review-findings.json`, stamped with the PR's head sha — an interrupted review re-enters at the preview from this file; matching head sha means no agent re-dispatch.

### Phase 6 — Preview gate (mandatory)

`AskUserQuestion` — but first, the constructed payload is shown:

```
─────────────────────────────────────────────────────────
Review for #142: feat(billing): add proration on plan changes
Computed event: REQUEST_CHANGES

Overall body:
  Adds proration on plan changes. 2 real bugs in the proration math, 1
  untested cycle-boundary case, and 1 API-surface concern (private method
  exposed via bracket access).

Comments (4):
  src/billing/proration.ts:47        [bug]          Off-by-one: range stops short of cycleEnd
  src/billing/proration.ts:88        [bug]          Null deref on first-month users
  src/billing/proration.ts:55-80     [test]         Cycle-boundary downgrade branch untested
  src/api/billing.ts:120             [api-surface]  Endpoint reaches into BillingService internals
─────────────────────────────────────────────────────────
```

```
- ◉ Post the review as shown
- ○ Edit / drop specific comments
- ○ Switch to summary-only mode (text dump, don't post)
- ○ Cancel
```

Pick `Post the review as shown`.

### Phase 7 — Post

Default path uses `gh api` (atomic batched POST):

```bash
echo "$PAYLOAD_JSON" | gh api repos/${OWNER}/${REPO}/pulls/142/reviews \
  --method POST --input - --jq '.html_url'
```

If the GitHub MCP plugin is installed, the orchestrator routes through `mcp__plugin_github_github__pull_request_review_write` (create-pending) → loop `add_comment_to_pending_review` → submit-pending instead. Same end-result on GitHub.

orc echoes the posted review URL.

The teammate opens PR #142 and sees:
- A REQUEST_CHANGES review with the framing paragraph at the top
- Four inline comments anchored to the exact files/lines
- For two of them (bugs), a one-click "Apply suggestion" button rendering the suggested code fix

## Artifacts

The artifact lives on GitHub (the submitted review); discussion happens in the PR. One `.orc/` write: `review-findings.json` (merged findings + computed event, head-sha-stamped) persists before the preview gate, so an interrupted review resumes at the preview instead of re-running the agents.

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

- **`/orc:code-review 142 --summary-only`** — produces the legacy markdown text-block (Bugs / Security / Tests sections) and does NOT post anything to GitHub. Useful when you want markdown to paste into Slack/Notion or you're researching a PR rather than reviewing it.
- **`/orc:code-review 142 --dry-run`** — runs through the preview gate but never posts. The constructed payload is echoed as JSON for inspection. Pair with `--soft-tests` to see how the event would change if test gaps weren't blocking.
- **`/orc:code-review 142 --soft-tests`** — `test`-severity findings drop to COMMENT instead of forcing REQUEST_CHANGES. For repos with weak test culture or PRs you explicitly want to land despite test gaps.
- **Agent self-contradiction case** — say `orc-pr-reviewer` writes `summary: "Approve. Findings are non-blocking."` but `findings` includes a `bug`. The Phase 4 sanity-check fires a `[!WARNING]` **⚠️ Caution** callout: *Reviewer wrote "approve" but flagged 2 bug-severity findings. Severity rule overrides verdict — posting as REQUEST_CHANGES.*
  
  This is the failure mode the new severity rule was specifically designed to catch.
- **PR is too big to review in one shot** — comment that the PR should be split, then APPROVE the trivial portion or REQUEST_CHANGES on the structural pieces. Don't pretend to review 60 files in one read.
- **You disagree with a finding** — pick `Edit / drop specific comments` at the preview gate. The comments are numbered and edited in ONE batched `AskUserQuestion` call (`multiSelect` questions covering chunks of 4; default = keep all; rewrites ride each question's free-text Other as `<n>: <new text>`), then a single loop back to the preview — never a one-question-per-comment loop.
- **You want to do a "vibes" review without the agent** — fine, but you lose the systematic guideline + bug + security + tests + requirements pass. Use the agent for the systematic pass and add your "vibes" reading on top.
- **`/orc:code-review --audit`** — repo-wide security pass instead of a PR review: `orc-security-reviewer` in audit scope over the whole working tree, plus a secret scan (gitleaks when installed, high-signal Grep fallback). No PR ref needed; nothing is posted to GitHub — output is a markdown summary grouped by severity.

## Iron rules in play

- **Severity-event mapping is computed mechanically.** Agents do NOT decide the verdict. Phase 4 catches and overrides any agent text saying "approve" while flagging bugs.
- **Preview gate is mandatory.** No flag bypasses it; nothing posts until the user picks `Post the review as shown`.
- **Max 15 inline comments.** Over-commenting erodes signal; the orchestrator surfaces the cap and asks the user to drop overflow.
- **No false positives.** The agent's confidence rule (≥ 0.8) + the preview-gate's per-comment edit option both guard this.
- **No AI attribution.** Reviews read as your voice. The agent is the lens, you are the reviewer.
- **Insight callouts are not for PR comments.** Save the `> [!IMPORTANT]` **💡 Insight** format for conversations, not GitHub threads — those need to read as engineer-to-engineer.
