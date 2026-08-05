---
name: review-contract
description: The canonical review findings contract — JSON finding schema, severity enum, mechanical severity→event mapping, and the confidence ≥0.8 rule shared by orc-pr-reviewer, orc-security-reviewer, and the inline-review posting layer. Use when producing, merging, or posting structured review findings, or when building a new reviewer agent.
---

# Review contract

One schema, one severity vocabulary, one event rule — defined here and only
here. Reviewer agents preload this skill; the posting layer (`orc:inline-review`)
and any new reviewer agent reference it instead of restating it.

## Finding schema

Reviewer agents return **strict JSON only** (no surrounding markdown, no prose
preamble):

```json
{
  "summary": "≤ 2 sentences, ~40 words: one clause on what the PR does + finding counts by severity. Informational only — does NOT decide the event.",
  "findings": [
    {
      "path": "src/auth.ts",
      "line": 42,
      "start_line": null,
      "side": "RIGHT",
      "severity": "bug",
      "title": "Null deref when token absent",
      "body": "When `req.headers.authorization` is missing, `parseToken()` returns null and the next line dereferences `.userId` unconditionally — 500 to client, no log. Guard with an early return.",
      "suggestion_code": "const token = parseToken(req);\nif (!token) return res.status(401).end();",
      "confidence": 0.92
    }
  ]
}
```

Zero findings: `{"summary": "No actionable issues found. …", "findings": []}` —
the posting layer computes APPROVE from the empty list.

### Field semantics

- **Required per finding:** `path`, `line`, `severity`, `title`, `body`, `confidence`.
- **Optional:** `start_line` (multi-line spans: `start_line: 45, line: 47`; else `null`), `suggestion_code` (see gate below; else `null`).
- **`path`** — repo-relative POSIX path. NOT a URL, NOT `a/`- or `b/`-prefixed. In workspace mode, still repo-relative; the orchestrator prefixes `[repo:<name>]`.
- **`line`** — line number in the **NEW** file (post-change), computed from the diff hunk header `@@ -OLD,N +NEW,N @@` plus offset within the hunk. NOT the hunk offset.
- **`side`** — always `"RIGHT"` (the new/changed code).
- **`title`** — ≤ 80 chars, one line.
- **`body`** — `orc:caveman-review` tone: terse, actionable, signal-only.
- **`confidence`** — 0–1. **Drop the finding entirely if < 0.8.** A noisy review burns the author's time; false positives erode trust faster than misses.

### `suggestion_code` gate

Set only when ALL hold; otherwise `null` and describe in `body`:

1. **Length** — ≤ 6 lines. Longer "fixes" are refactors disguised as fixes.
2. **Completeness** — committing it FULLY resolves the issue.
3. **Mental compile** — syntactically valid, references only symbols visible at that line, no imports the author must add separately.

## Severity enum → event mapping (the iron rule)

`severity` ∈ `"bug" | "security" | "api-surface" | "test" | "nit" | "suggestion" | "question"`.

Agents do NOT decide the review event. The posting layer computes it
mechanically from the **set** of severities; the agent's `summary` narrative is
ignored for the verdict:

| Severity | Meaning | Effect |
|----------|---------|--------|
| `bug` | Real correctness problem landing on this PR | **Forces REQUEST_CHANGES** (one is enough) |
| `security` | Auth bypass, injection, secret leak, unsafe deserialization, SSRF, … | **Forces REQUEST_CHANGES** |
| `api-surface` | Wrongly exposed endpoint, breaking API change, dead public path | **Forces REQUEST_CHANGES** |
| `test` | Real test gap on the changed surface | **Forces REQUEST_CHANGES**; `--soft-tests` relaxes to COMMENT |
| `nit` | Style/naming the linter doesn't catch | COMMENT only |
| `suggestion` | Improvement opportunity, no correctness concern | COMMENT only |
| `question` | Not sure it's a bug — asking the author | COMMENT only |

```
def compute_event(findings, soft_tests=False):
    severities = {f.severity for f in findings}
    blocking = {"bug", "security", "api-surface"}
    if not findings:
        return "APPROVE"
    if severities & blocking:
        return "REQUEST_CHANGES"
    if "test" in severities and not soft_tests:
        return "REQUEST_CHANGES"
    return "COMMENT"
```

### Self-contradiction detection (mandatory at the posting layer)

If the `summary` contains any of `["approve", "lgtm", "looks good", "no concerns", "non-blocking"]`
AND any finding has a blocking severity, warn the user
(`> **⚠️ Caution**` callout), then post the **computed** event anyway. The
contradiction never ships.

## Universal reviewer rules

- **Only the diff.** Never flag pre-existing issues the change didn't touch or surface.
- **Confidence ≥ 0.8 or drop.** Applies to every finding, every reviewer.
- **JSON-only output** from agents; the orchestrator parses it directly.
- **Severity is by impact, not ease of fix.** A one-line-fix auth bypass is still `security`.

## Consumers

- `orc-pr-reviewer` / `orc-security-reviewer` — preload this skill (`skills:` frontmatter) and emit the schema above.
- `orc:inline-review` — converts findings to a posted GitHub review; owns the posting mechanics (backends, preview gate, ≤15-comment cap) and defers to this contract for schema + event rule.
- New reviewer agents (e.g. CI or docs lenses) — preload this skill; add only their lens-specific taxonomy.
