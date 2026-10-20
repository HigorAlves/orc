<!-- orc:triage/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Intake a raw report

Reached by a Sentry issue or pasted text: a report with no tracker item yet. Pasted text covers a chat message, an email, a stack trace or a customer complaint.

## Read the source

1. For `--sentry`, run `sentry issue view <id>` per `orc:sentry-cli`.
2. Run `sentry issue events <id>` and read the latest event.
3. Note the stack trace, release, environment, first seen, last seen and event count.
4. For pasted text, extract the claim, the steps, the expected and the actual result.
5. If the paste names a tracker item, stop and run `orc:triage/P2` on that item.

> **🛑 No Sentry writes**
>
> Never resolve, ignore, assign, merge or comment on a Sentry issue from triage.

## Check validity

6. Run every step of `orc:triage/VALIDITY`.
7. Pick the category role: `bug` or `enhancement`, per `orc:triage/ROLES`.

## Verdict

8. Print `**⛔ Gate — intake verdict**`: verdict, category, severity, one line of evidence.
9. When the verdict is duplicate, already done, out of scope or not reproduced, stop after the verdict.
10. Otherwise ask via `AskUserQuestion`: file it on the tracker, or keep the verdict only.

NOTE: a raw report writes nothing until the user picks "file it". The verdict alone leaves no state.

## File it

11. Draft the item: title, the reporter's claim, the validity evidence, the Sentry link when present.
12. For valid, pick `ready-for-agent` with a brief, or `ready-for-human`, per `orc:triage/BRIEFS`.
13. For needs info, pick `needs-info` and list the missing facts as triage notes.
14. Print `**📋 Preview — tracker writes**` with the body and both roles, verbatim.
15. Ask via `AskUserQuestion` to confirm, then create the item through the tracker dispatch.

## Next

16. Print the `**➡️ Next**` line per `orc:triage/VALIDITY`. Never start the suggested command.
