<!-- orc:triage/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Triage a specific item

## Gather context

1. Read the full item: body, comments, labels, author, dates; for a PR, the diff too.
2. Parse prior triage notes; never re-ask a resolved question.
3. Explore the codebase with the domain glossary; respect ADRs in the area.

## Check validity

4. Run every step of `orc:triage/VALIDITY`; report where you looked.
5. Map the verdict: already done or duplicate is `wontfix` (step 13); needs info is `needs-info`.

NOTE: a confirmed reproduction makes a much stronger agent brief.

## Recommend

6. Print `**⛔ Gate — triage recommendation**` (per `orc:callouts`): category, state, verdict and why.
7. Add a brief codebase summary with the validity evidence.
8. Ask via `AskUserQuestion`: accept the recommendation, pick a different state, or grill first.

## Grill when needed

9. If the request needs fleshing out, run `orc:grilling` with `orc:domain-modeling`, one round at a time.
10. Sharpen domain terms; update `GLOSSARY.md` and ADRs inline as decisions land.

## Apply the outcome

11. Print `**📋 Preview — tracker writes**` with every label change, comment body and close, verbatim.
12. Ask via `AskUserQuestion` to confirm before touching the tracker.
13. Apply the outcome per the state list below, using the roles in `orc:triage/ROLES`.
14. Print the `**➡️ Next**` line per `orc:triage/VALIDITY`. Never start the suggested command.

Outcomes by state:

- `ready-for-agent` — post an agent brief comment (`orc:triage/BRIEFS`).
- `ready-for-human` — same structure, plus one line on why delegation fails: judgment calls, external access, design decisions, manual testing.
- `needs-info` — post triage notes (`orc:triage/BRIEFS`).
- `wontfix`, already implemented — point to where it lives; never write the out-of-scope KB (that is for rejected requests, not built ones).
- `wontfix`, duplicate — link the original, then close.
- `wontfix`, rejected bug — polite explanation, then close.
- `wontfix`, rejected enhancement — record it in `docs/agents/out-of-scope.md` (`orc:triage/OUT-OF-SCOPE`), link the entry from the closing comment, then close.
- `needs-triage` — apply the role; optional comment when there is partial progress.
