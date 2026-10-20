<!-- orc:code-review/P1 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 1 — Scope: eligibility, diff, standards, spec

## Eligibility

1. Run `gh pr view <ref> --json state,isDraft,reviewDecision,author,title,additions,deletions,changedFiles`.
2. If `gh pr view` fails, stop and report the exact error.
3. If `state` is `CLOSED` or `MERGED`, stop and report.
4. If `isDraft` is true, ask via `AskUserQuestion` whether to review anyway.
5. If `reviewDecision` shows you already reviewed, stop unless the user opts to re-review.

## Diff

6. Run `gh pr diff <ref> > /tmp/pr-<ref>.diff`.
7. If the diff file is empty, stop and report. Never dispatch agents on an empty diff.

## Documented standards

8. `Glob` for `CLAUDE.md`, `CODING_STANDARDS.md`, `CONTRIBUTING.md` at the root and in changed directories.
9. Record their paths for P3.

NOTE: these files are the Standards axis. Where one endorses something the smell baseline (`orc:review-contract`, `references/SMELLS.md`) would flag, the repo wins.

## Spec

10. Scan the PR body and commit messages for an issue reference.
11. If found, fetch it with `gh issue view <n> --json title,body`.
12. Record the spec content for P3; if none, skip silently.

NOTE: reference forms: `#123`, `Closes #45`, `Resolves org/repo#67`, an issue URL, a Jira key in branch or title. Cross-repo: `gh api repos/<org>/<repo>/issues/<n>`. Without a spec, conformance is not assessed.
