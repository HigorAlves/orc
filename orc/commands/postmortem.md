---
description: Author a blameless incident postmortem — timeline, root causes, action items — filing each P0 action item as a tracker issue. Status reaches Final only when all P0 items close.
argument-hint: "[<short-slug>] [--severity sev-1|sev-2|sev-3]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh issue create:*)
  - Bash(gh issue list:*)
  - Bash(gh issue view:*)
  - Bash(git log:*)
  - Bash(git:*)
  - Bash(date:*)
---

# /orc:postmortem

Capture what happened, why it happened, and what changes to prevent recurrence.

## Arguments

- `<short-slug>` — optional. Brief incident identifier (e.g. `db-failover-2026-05-01`). Prompts if omitted.
- `--severity sev-1|sev-2|sev-3` — optional. If omitted, the workflow proposes a tier and confirms with the user.

## Workflow

### Phase 1 — Gate

Invoke `orc:postmortem`. Confirm a postmortem is warranted:
- customer-visible incident, OR
- an on-call page fired, OR
- near-miss with a real defect, OR
- recurrence of the same incident type.

If borderline (e.g. caught in CI, no production impact), print the Gate headline (`> [!NOTE]` + `**⛔ Gate — postmortem-worthy?**`, per `orc:insights`), then `AskUserQuestion`:
- "Write a full postmortem anyway"
- "Write a one-paragraph near-miss note instead (no full template)"
- "Skip — caught early, no learning to capture"

### Phase 2 — Establish severity

If no `--severity` flag: propose a tier based on user description and confirm via `AskUserQuestion`:
- SEV-1: total outage / data loss / security event
- SEV-2: significant degradation / partial outage
- SEV-3: edge-case impact / near-miss

If the project doesn't have severity definitions, note this — surface a suggestion to author them as an ADR / policy doc afterward.

### Phase 3 — Initialize workspace

Determine current branch. Create `.orc/<sanitized-branch>/files/`. Write `checkpoint.md` (phase=3, command=postmortem, severity=<tier>, total_phases=7). Register in `.orc/orc.json`.

Decide where the document lives via `AskUserQuestion`:
- "In-repo at `docs/postmortems/YYYY-MM-DD-<slug>.md`"
- "Shared doc tool (Notion / Confluence / Google Doc) — author in `.orc/` first; you'll mirror it manually"

### Phase 4 — Build the timeline FIRST

The timeline is the spine; everything else depends on it. Walk the user through:

1. Detection (what fired, who saw it, when).
2. Response (who ack'd, what they checked first, key dashboard URLs).
3. Mitigation (what change actually stopped the bleeding).
4. Resolution (when traffic / metrics returned to baseline).

Sources to ask the user to surface (don't paraphrase from memory): chat transcript, pager log, deploy log, dashboard screenshots, status page edits, customer support tickets.

Write the timeline as a Markdown table per the `orc:postmortem` template. Save partial draft to `.orc/<branch>/files/postmortem-<slug>.md`. Bump checkpoint to phase=4.

### Phase 5 — Root causes + contributing factors

Using `Task` you may dispatch `orc-debug-investigator` if the root cause is technically deep and not yet pinned down — but keep its output as the **mechanism** input, not the postmortem itself (postmortems learn from the *system around* the bug, debug-investigator finds the bug).

For each root cause: use the "why?" chain (3–5 deep). **Stop when "fix this" becomes a credible action item, not when "an engineer made a mistake."**

Use roles, not names, in causal language. The `orc:postmortem` skill is non-negotiable on this — refuse to draft a section that names an individual as cause.

Bump checkpoint to phase=5.

### Phase 6 — Action items + file issues

For each action item:
- Owner (role or name)
- Severity (P0 / P1 / P2)
- Tracking link
- Done-when (observable outcome)

For each P0 item, file a tracker issue immediately:

```bash
gh issue create --title "Postmortem AI: <short title>" --body "<one paragraph context + done-when>" --label "postmortem,p0"
```

Capture the issue URL, paste it into the Action Items table. Repeat for each item. P1 items: file as issues if user agrees; P2: optional.

**Refuse to author action items shaped like "be more careful" or "communicate better."** Loop back via `AskUserQuestion` if any pass slips through.

Bump checkpoint to phase=6.

### Phase 7 — Place, commit, set status

Print the Gate headline (`**⛔ Gate — postmortem placement**`), then `AskUserQuestion`:
- "Commit to `docs/postmortems/...` and mark status `In review`"
- "Commit and mark status `Action items in flight` (P0 issues are filed but not closed)"
- "Save as draft only"

If committing: copy from `.orc/` to `docs/postmortems/`, then `orc:git-commit`. Suggested message: `docs(postmortem): <slug> (<severity>)`.

Bump checkpoint to phase=done.

## Status discipline

The document's `Status` field has a real lifecycle:
1. **Draft** — being authored.
2. **In review** — being read by the team.
3. **Action items in flight** — committed, but P0 actions are still open.
4. **Final** — all P0 actions closed, OR explicitly punted with documented rationale.

`/orc:postmortem` only moves status to **Final** when `gh issue list --label postmortem,p0 --state open` returns empty (or the user explicitly punts a P0 with a reason).

## Iron rule (from the skill, restated)

A postmortem with a great narrative and no action items has FAILED. A postmortem with three concrete action items and a sloppy narrative is succeeding. The deliverable is the change that prevents recurrence, not the document.

## Output

- `docs/postmortems/YYYY-MM-DD-<slug>.md` (committed) OR `.orc/<branch>/files/postmortem-<slug>.md` (draft only)
- `.orc/<branch>/files/checkpoint.md`
- N tracker issues filed (one per P0 action item, optional for P1)
- One commit
- Echoes the document path, the open P0 count, and a hint to revisit `/orc:postmortem` once P0s close to flip status to Final
