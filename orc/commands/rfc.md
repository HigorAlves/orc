---
description: Author a system-design RFC — proposes a non-trivial change BEFORE implementation, surfaces alternatives, and invites critique. Differs from /orc:plan (design settled) and /orc:adr (decision recorded).
argument-hint: "[--grill] [--review <path>] [<title>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(ls:*)
  - Bash(git *)
  - Bash(date:*)
---

# /orc:rfc

Author a Request for Comments (RFC) before committing to an implementation.

## Arguments

- `<title>` — optional. One-line problem statement (will be polished into a noun phrase). Prompts if omitted.
- `--grill` — after drafting, invoke `orc:grill-me` to stress-test the design.
- `--review <path>` — review an existing RFC instead of authoring a new one. Walks the doc with critique focused on missing alternatives, undefined success criteria, hidden assumptions.

## Workflow

### Phase 1 — Gate (when authoring)

Invoke `orc:rfc-writing`. Apply its "any of these are true" test:
- multi-team / multi-service touchpoints
- ≥ 2 weeks of engineering effort
- locks in technology, protocol, or interface
- you're genuinely unsure between alternatives

If none are true, surface via `AskUserQuestion`:
- "Smaller scope — use `/orc:plan` instead (assumes design is settled)"
- "Even smaller — use `/orc:adr` (recording a decision already made)"
- "Override — proceed with the RFC anyway"

### Phase 2 — Initialize workspace

Determine the current branch (sanitize). Create `.orc/<sanitized-branch>/files/` if absent. Locate `docs/rfcs/` (create if absent, add `docs/rfcs/README.md` linking to the convention). Find the next sequence number.

Write `checkpoint.md`: phase=2, status=in_progress, command=rfc, total_phases=5 (or 6 with `--grill`), started_at=now. Append entry to `.orc/orc.json`.

### Phase 3 — Draft Goals + Non-goals first

These two sections bound everything that follows. Use `AskUserQuestion` to walk them:
- "What MUST this proposal accomplish?" (goals)
- "What is explicitly out of scope?" (non-goals)

Save the partial draft to `.orc/<branch>/files/rfc-NNNN.md`. Bump checkpoint to phase=3.

### Phase 4 — Draft remaining sections

Following the template from `orc:rfc-writing`, fill: Background, Proposed design (with subsections: high-level shape, key interfaces, failure modes, migration), Alternatives considered, Open questions, Risks, Success criteria.

Set `Decision deadline` to today + 7 days (1 week) by default; user can override via `AskUserQuestion`.

Save to the workspace draft. Bump checkpoint to phase=4.

### Phase 5 (optional, with `--grill`) — Stress-test

Invoke `orc:grill-me` against the draft. Update the document with answers to questions exposed. Bump checkpoint.

### Phase 6 — Place + commit

Use `AskUserQuestion`:
- "Commit to `docs/rfcs/NNNN-<kebab-title>.md` and open a GitHub Discussion / PR thread"
- "Commit only — no thread yet"
- "Save as draft only — keep in `.orc/` for now"

If committing: copy `.orc/<branch>/files/rfc-NNNN.md` to `docs/rfcs/NNNN-<kebab-title>.md`, then `orc:git-commit`. Suggested message: `docs(rfc): NNNN — <title>`.

Bump checkpoint to phase=done. Echo the document path + decision deadline to the user.

## `--review` mode

If invoked with `--review <path>`:
1. Read the existing RFC.
2. Critique with focus on: are alternatives genuinely considered (or strawmanned)? Are success criteria measurable? Are non-goals explicit? Are open questions surfaced or papered over? Are risks honest?
3. Return a finding list using `orc:caveman-review` discipline (one line per finding, file:line format).
4. Do NOT edit the document — leave that to the author.

## Iron rule

A draft RFC that never moves to Approved or Rejected is wasted ink. The decision deadline exists to force closure. When the deadline passes:
- If approval seems to be there: confirm and mark Approved.
- If consensus hasn't formed: extend the deadline ONCE (1 week max) or escalate to a deciding party.
- If the design is wrong: mark Rejected — that's a successful RFC outcome, not a failure.

## Output

- `docs/rfcs/NNNN-<kebab-title>.md` (committed)
- `.orc/<branch>/files/rfc-NNNN.md` (workspace draft + checkpoint)
- One commit
- Echoes path + decision deadline + suggested next-step (open discussion thread, request reviewers)
