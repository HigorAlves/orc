<!-- orc:ship/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Compose the PR (no gate)

Compose before asking anything: the completion decision and the PR preview then fit in one gate (orc:ship/P4) instead of two.

1. If uncommitted changes exist, invoke `orc:git-commit`.
2. Determine the PR title from the branch name and recent commit subjects.
3. Compose the body: terse by default, long-form with `--verbose` (both below).
4. Run `orc-state get --field jiraTicket` (read-for-data per `orc:state-protocol`).
5. If a ticket is bound, append the Jira trailer as the last body line.
6. If `jiraTicket` is empty, skip the trailer silently.

## Terse body (default)

Invoke `orc:caveman-pr` and follow it exactly: a tight title and body with only the sections that add signal (Why / What changed / How tested / Notes / trailers). Reviewers need a why and a how-tested, not a tour of the diff.

## Long-form body (`--verbose`)

Use when the change needs narrative context: big migrations, multi-team reviews.

- **Summary** — the smallest visual that makes the change clear: pseudocode for logic, a call tree for runtime flow, a component tree for UI, a shallow file tree for layout, a mermaid sequence for interaction, a `diff`-sketch when the surrounding shape already exists. Prose beside it, brief.
- **Why** — link to plan / issue / PRD if available; `.orc/<branch>/files/plan.md` if present.
- **Evidence** — before/after: screenshots or the recording for a visual change at `.orc/<branch>/files/qa/`, else the exact test run that failed before and passes now.
- **Merge danger** — `Door: one-way | two-way` with what makes a one-way door hard to walk back, and `Blast radius:` in a few words with the ramifications.
- **Checklist** — boxes for the reviewer.

## Jira trailer (both modes)

```
<KEYWORD> <KEY>
```

`KEYWORD` defaults to `Resolves`. Override per shop with `export ORC_JIRA_PR_KEYWORD=Closes` (or `Fixes`).
