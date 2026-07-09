---
description: Author a Technical Requirements Document (TRD) — produce a numbered docs/trds/NNNN-*.md following the orc:trd-writing template. Optionally seeded from a prior PRD.
argument-hint: "[<title>] [--from-prd NNNN] [--from-jira <KEY>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(ls:*)
  - Bash(git:*)
  - Bash(date:*)
  - Bash(acli jira workitem view:*)
  - Bash(jq:*)
---

# /orc:trd

Author a new TRD following `orc:trd-writing`. Lives at `docs/trds/NNNN-<kebab-title>.md`.

## Arguments

- `<title>` — optional. Short noun phrase describing the contract being pinned down (e.g. "webhook retry contract"). If omitted, prompts via `AskUserQuestion`.
- `--from-prd NNNN` — optional. Reads `docs/prds/NNNN-*.md` and seeds the TRD's `Goals`, `Constraints`, and `Linked PRD(s)` sections from it.
- `--from-jira <KEY>` — optional. Seeds `Linked tickets` and (if useful) the `Background / context` section from a Jira ticket via `orc:jira-cli`.

## Workflow

### Phase 1 — Confirm a TRD is warranted

Invoke `orc:trd-writing`. Apply its "all of these are true" test:

- A PRD (or equivalent product spec) has settled the "what & why."
- Non-trivial technical surface area (new APIs / data / failure modes / dependencies / contracts).
- Multiple engineers / services / repos need to agree on the contract.

If borderline, print the Gate headline (`> [!NOTE]` + `**⛔ Gate — is this TRD-worthy?**`, per `orc:insights`), then `AskUserQuestion`:

- "Yes, write the TRD"
- "Smaller — single design note in code instead"
- "RFC needed first — alternatives are still being debated → `/orc:rfc`"
- "ADR instead — single decision to record, not a contract → `/orc:adr`"
- "Just a plan — go straight to `/orc:plan`"

### Phase 2 — Locate `docs/trds/`

If the directory doesn't exist, create it and add a one-line `docs/trds/README.md` linking to `orc:trd-writing`. Find the next sequence:

```bash
ls docs/trds 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1
```

Increment to get the new four-digit sequence (`0001` if first).

### Phase 3 — Gather inputs

If `--from-prd NNNN` was passed:

1. Resolve the PRD path: `ls docs/prds/NNNN-*.md` → exactly one file expected. If zero matches, surface and ask user to confirm/correct. If multiple, surface and ask.
2. Read the PRD. Extract:
   - Title → suggest as the TRD's title prefix.
   - Problem + Audience + Success metrics → seed the `Goals` and `Background / context` sections.
   - Constraints / out-of-scope from the PRD → seed `Constraints` and `Non-goals`.
   - Linked tickets → carry forward into `Linked tickets`.

If `--from-jira <KEY>` was passed, fetch via `acli jira workitem view --json` and use the result to seed `Linked tickets` and (if useful) `Background / context`.

If neither flag was passed, surface `AskUserQuestion`: "Is there a PRD this TRD serves? (paste PRD number / no PRD — context lives in conversation / cancel)". A TRD without a product context is suspect — make the user choose explicitly.

### Phase 4 — Draft

Author `docs/trds/NNNN-<kebab-title>.md` using the template from `orc:trd-writing`. Fill every section. The **`Public interfaces & contracts`** section is the load-bearing one — if it ends up thin, the TRD isn't ready; pause and ask the user for the missing detail before committing.

**Don't leave `TBD` or placeholder text** — delete sections that genuinely have no content.

### Phase 5 — Review

Print the Gate headline (`**⛔ Gate — TRD review**`), show the draft, then `AskUserQuestion`:

- "Looks good — commit"
- "Edit before commit" (loop back to Phase 4)
- "Save as Draft (Status: Draft)" — commits with status flag flipped

### Phase 6 — Commit + cross-link

Invoke `orc:git-commit`. Suggested message: `docs(trd): NNNN — <title>`.

Surface a hint to the user:

- "Link this TRD from the source PRD (if any): edit `docs/prds/NNNN-*.md` to add `Linked TRD: TRD-NNNN`."
- If a Jira ticket was bound to the current orc session, surface: "Want to attach this TRD to bound ticket `<KEY>`? Use `/orc:jira` to add a comment with the path."
- "Next step is usually `/orc:rfc` if alternatives still need debate, or `/orc:plan` if the contract is uncontested."

## Output

- New `docs/trds/NNNN-<kebab-title>.md`
- (if absent before) new `docs/trds/README.md`
- (if `--from-prd` passed) optional edit to the source PRD adding the back-link
- One commit
- Echoes path to the new TRD + suggested follow-ups

## Iron rule

TRDs with empty `Failure modes` or `Public interfaces & contracts` sections are not TRDs — they're fancy plans. If either section can't be filled with real content, this isn't TRD-shaped work; reach for a plan or an RFC instead.

## Relationship to `/orc:flow`, `/orc:rfc`, `/orc:adr`

- `/orc:flow` does not call `/orc:trd` — TRDs are usually authored before `/orc:flow` runs (between PRD and Plan).
- `/orc:rfc` debates alternatives; `/orc:trd` commits to one contract. If you find yourself listing 3+ approaches, switch to `/orc:rfc`.
- `/orc:adr` records a single decision after debate; `/orc:trd` is the broader contract. A TRD often spawns multiple ADRs as decisions lock in.
