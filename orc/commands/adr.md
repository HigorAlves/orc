---
description: Author an Architecture Decision Record (ADR) — produce a numbered docs/adr/NNNN-*.md following the orc:adr-writing template. Also handles supersession and status transitions on existing ADRs.
argument-hint: "[<title>] [--supersede NNNN]"
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
---

# /orc:adr

Author a new ADR (or update an existing one's status) following `orc:adr-writing`.

## Arguments

- `<title>` — optional. Short noun phrase describing the decision (e.g. "use Postgres for primary store"). If omitted, prompts via `AskUserQuestion`.
- `--supersede NNNN` — optional. Marks an existing ADR as superseded and authors a new one whose `Context` cites the predecessor.

## Workflow

### Phase 1 — Confirm an ADR is warranted

Invoke `orc:adr-writing`. Apply its "all of these are true" test:
- architectural (multi-module / boundary / convention)
- non-obvious (real alternatives exist)
- durable (≥ 3 months expected lifetime)

If borderline, print the Gate headline (`**⛔ Gate — is this ADR-worthy?**`, one line on which criterion is borderline, per `orc:insights`), then `AskUserQuestion`:
- "Yes, write the ADR"
- "Smaller — propose a single-paragraph design note in the relevant code instead"
- "Skip — this isn't really an architectural decision"

### Phase 2 — Locate `docs/adr/`

If the directory doesn't exist, create it and add a one-line `docs/adr/README.md` linking to the convention. Find the next sequence:

```bash
ls docs/adr 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1
```

Increment to get the new four-digit sequence (`0001` if first).

### Phase 3 — Draft

Author `docs/adr/NNNN-<kebab-title>.md` using the template from `orc:adr-writing`. Fill every section with real content. **Don't leave `TBD` or placeholder text** — delete sections that genuinely have no content.

If `--supersede NNNN` was passed:
1. Read `docs/adr/NNNN-*.md`. Update its status to `Superseded by <new-NNNN>` and bump its date.
2. The new ADR's `Context` MUST cite the predecessor and explain why the situation changed.

### Phase 4 — Review

Print the Gate headline (`**⛔ Gate — ADR review**`), show the draft, then `AskUserQuestion`:
- "Looks good — commit"
- "Edit before commit" (loop back to Phase 3)
- "Save as draft (Status: Proposed)" — commits with status flag flipped

### Phase 5 — Commit + cross-link

Invoke `orc:git-commit`. Suggested message: `docs(adr): NNNN — <title>`.

Surface a hint to the user: "Link this ADR from any code or doc that depends on the decision — the link should be the entry point, not the reverse." (`orc:adr-writing` documents this convention.)

## Output

- New `docs/adr/NNNN-<kebab-title>.md`
- (if `--supersede`) updated predecessor file
- One commit
- Echoes path to the new ADR

## Iron rule

ADRs in **Status: Proposed** that never get accepted are rot. If you draft as Proposed, set a follow-up reminder via `AskUserQuestion`: "Revisit this in 1 week / 1 month / never (auto-archive)".
