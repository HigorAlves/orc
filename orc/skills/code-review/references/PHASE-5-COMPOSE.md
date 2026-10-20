<!-- orc:code-review/P5 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 5 — Compose the review

1. Invoke `orc:inline-review`.
2. Write the overall body: at most two sentences, about 40 words, caveman tone.
3. State what the PR does, then the finding counts by severity.
4. When a spec was found, count spec findings separately from standards findings.
5. Build one comment per finding: `path`, `line`, `start_line`, `side: "RIGHT"`, `body`.
6. Append the suggestion block when `suggestion_code` is set and passes `orc:inline-review`'s rules.
7. If more than 15 comments remain, print the comment-cap gate and ask which to drop.
8. In multi-PR mode, name every PR in the body and state the merge order from the workspace plan.

Merge-order line: "Merge order: api → ui (per workspace plan)".

Example body:

> "CSV export for /reports. 2 bugs (serialization), 1 untested branch, 2 nits."

Comment-cap gate:

```markdown
> **⛔ Gate — comment cap**
>
> <N> findings exceed the 15-comment cap.
```

`AskUserQuestion` options: drop all nits then take the top 15 by severity; show the full list to pick; cancel.

NOTE: the body never restates inline comments, never praises, never hedges. The two axes (standards, spec) are never reranked against each other (`orc:review-contract`).
