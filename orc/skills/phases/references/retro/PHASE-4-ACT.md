<!-- orc:retro/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Act

## Apply

> **⚠️ Caution**
>
> Commit on the current feature branch only, never on a protected branch.

1. For each candidate the user chose to apply, make the in-repo change.
2. Commit each candidate separately via `orc:git-commit`.
3. For a new check, run it on the mistake it targets; verify it fails.
4. Run the check after the fix; verify it passes.
5. If either run disagrees, do not commit the check.

NOTE: the retro never ships an unverified guardrail (`orc:verification-before-completion`).

## File

> **🛑 Tracker writes**
>
> Step 9 creates issues. The gate in step 8 is hard-outward; `--auto` never skips it.

6. For each candidate the user chose to file, run the `orc:tracker-config` read protocol.
7. Print `**📋 Preview — tracker writes**` with every issue body verbatim.
8. Ask with `AskUserQuestion`.
9. On confirm, create each issue exactly as previewed.

Each issue carries the evidence, the proposed change, and the `needs-triage` label. No AI attribution anywhere in it.

## Close

10. Close with `**➡️ Next**`: what the next session starts with that this one did not.
