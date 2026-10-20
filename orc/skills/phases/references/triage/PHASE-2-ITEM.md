<!-- orc:triage/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Triage a specific item

## Gather context

1. Read the full item: body, comments, labels, author, dates; for a PR, the diff too.
2. Parse prior triage notes; never re-ask a resolved question.
3. Explore the codebase with the domain glossary; respect ADRs in the area.
4. Search for an existing implementation by domain concept, not the request's wording.
5. Report where you looked; if found, the outcome is already-implemented `wontfix` (step 16).
6. Read `docs/agents/out-of-scope.md` per `orc:triage/OUT-OF-SCOPE`; surface any resembling concept.

NOTE: match the out-of-scope KB by concept similarity, not keywords: "night theme" matches a Dark Mode entry.

## Recommend

7. Print `**⛔ Gate — triage recommendation**` (per `orc:callouts`): one line with category, state and why.
8. Add a brief codebase summary, including whether the request is already implemented.
9. Ask via `AskUserQuestion`: accept the recommendation, pick a different state, or verify the claim first.

## Verify the claim (read-only)

> **⚠️ Caution**
>
> Investigate, never fix: no commits, no pushes, no tracker writes.

10. For a bug, reproduce it from the reporter's steps.
11. For a PR, check out the branch and run the relevant tests or commands.
12. Confirm the diff does what it claims, then switch back.
13. Report one of: confirmed (with the code path), failed to reproduce, insufficient detail.

NOTE: insufficient detail is a strong `needs-info` signal. A confirmed verification makes a much stronger agent brief.

## Grill when needed

14. If the request needs fleshing out, run `orc:grilling` with `orc:domain-modeling`, one round at a time.
15. Sharpen domain terms; update `GLOSSARY.md` and ADRs inline as decisions land.

## Apply the outcome

16. Print `**📋 Preview — tracker writes**` with every label change, comment body and close, verbatim.
17. Ask via `AskUserQuestion` to confirm before touching the tracker.
18. Apply the outcome per the state list below.

Outcomes by state:

- `ready-for-agent` — post an agent brief comment (`orc:triage/BRIEFS`).
- `ready-for-human` — same structure, plus one line on why delegation fails: judgment calls, external access, design decisions, manual testing.
- `needs-info` — post triage notes (`orc:triage/BRIEFS`).
- `wontfix`, already implemented — point to where it lives; never write the out-of-scope KB (that is for rejected requests, not built ones).
- `wontfix`, rejected bug — polite explanation, then close.
- `wontfix`, rejected enhancement — record it in `docs/agents/out-of-scope.md` (`orc:triage/OUT-OF-SCOPE`), link the entry from the closing comment, then close.
- `needs-triage` — apply the role; optional comment when there is partial progress.
