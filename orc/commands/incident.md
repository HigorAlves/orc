---
description: "Live incident response — intake a Sentry issue, stack trace, or symptom; assess severity and blast radius; gate mitigate-first vs root-cause-first; keep a UTC timeline as the fire unfolds; hand off to /orc:postmortem when stable. Use when production is broken RIGHT NOW; for the after-action write-up alone, use /orc:postmortem."
argument-hint: "[<sentry-issue-id-or-url> | <pasted stack trace> | <symptom>] [--severity sev-1|sev-2|sev-3]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(sentry:*)
  - Bash(jq:*)
  - Bash(date:*)
  - Bash(git log:*)
  - Bash(git branch --show-current:*)
  - Bash(git diff:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:incident

The during-the-fire half of incident handling. `/orc:postmortem` learns from an incident after it's over; `/orc:incident` runs one while it's happening: triage evidence, size the blast radius, choose mitigate-first or root-cause-first, and keep a timestamped timeline that becomes the postmortem's spine. **Stop the bleeding before you study the wound.**

## Arguments

- First argument (free-form) — one of:
  - A Sentry issue short ID (e.g. `PROJ-123`) or issue URL — pulled live via the `orc:sentry-cli` skill.
  - A pasted stack trace.
  - A described symptom ("checkout is 500ing since the 14:00 deploy").
- `--severity sev-1|sev-2|sev-3` — optional. Skips the severity proposal in Phase 2 (blast radius is still assessed).

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection). `loose` context → surface and stop (no state dir to write).

### Phase 1 — Intake + timeline start

1. Determine the current branch: `git branch --show-current`. Sanitize (`/` → `-`). Create `${ORC_STATE_DIR}/<sanitized-branch>/files/incident/`.
2. **Register the session.** Append an entry to `.orc/orc.json` with `command: "incident"`, `status: in_progress`, `current_phase: 1`, `total_phases: 5`, branch, `startedAt`. Write `checkpoint.md` (phase=1, command=incident) in `${ORC_STATE_DIR}/<sanitized-branch>/files/`.
3. **Start the timeline.** Create `${ORC_STATE_DIR}/<sanitized-branch>/files/incident/timeline.md`:

```markdown
# Incident timeline — <slug>

Append-only. One line per action or finding, UTC.

| Time (UTC) | Who | What |
|---|---|---|
| <date -u +%Y-%m-%dT%H:%M:%SZ> | orc | Incident session opened; intake: <sentry issue \| stack trace \| symptom> |
```

Every subsequent action or finding in ANY phase appends a row (`date -u +%Y-%m-%dT%H:%M:%SZ` for timestamps). This is an iron rule, not a suggestion — the timeline is what `/orc:postmortem` inherits.

4. **Classify the input and gather evidence:**
   - **Sentry issue ID/URL** → invoke the `orc:sentry-cli` skill (read its `references/agent-guidance.md` first, then `references/issue.md` / `references/event.md` as needed). Just run the commands — the CLI auto-handles auth and org/project detection:

     ```bash
     sentry issue view <SHORT-ID> --json
     sentry issue events <SHORT-ID> --json -n 5
     ```

     Capture: title, culprit, level, `count`, `userCount`, `firstSeen`, `lastSeen`, latest event's stack trace and tags (release, environment). On auth error (exit 10–19), tell the user to run `sentry auth login` and continue with whatever they can paste manually.
   - **Pasted stack trace** → identify the throwing frame, the entry point, and any release/version markers. `Grep` the repo for the frames to locate the code.
   - **Described symptom** → ask for the minimum concrete facts: what's broken, since when, how noticed (page, dashboard, customer report). If Sentry is available, offer to search: `sentry issue list -q "<terms>" --json --fields shortId,title,level,count,userCount,lastSeen`.
5. Save the evidence to `${ORC_STATE_DIR}/<branch>/files/incident/evidence.md`. Append timeline rows for what was pulled and what it showed.

### Phase 2 — Assess: severity + blast radius, then the gate

1. **Blast radius** — answer with evidence, not vibes:
   - **Who is affected**: `userCount` and `count` from Sentry when available; otherwise the user's best estimate, marked `(unverified)`.
   - **Since when**: `firstSeen`, and whether the start correlates with a deploy (`git log --oneline --since=<firstSeen>` on the deployed branch; Sentry event `release` tag when present).
   - **Scope**: one endpoint or everything; one region/tenant or all; error rate trending up, flat, or down (`lastSeen` recency).
2. **Severity** — if `--severity` wasn't passed, propose a tier (same ladder as `/orc:postmortem`) and confirm via `AskUserQuestion`:
   - SEV-1: total outage / data loss / security event
   - SEV-2: significant degradation / partial outage
   - SEV-3: edge-case impact / near-miss
3. Append the assessment to the timeline and `evidence.md`. Bump checkpoint to phase=2, record severity in `.orc/orc.json`.
4. **The strategy gate.** Print the Gate headline with a recommendation, per `orc:callouts`:

```markdown
> **⛔ Gate — mitigate first, or root-cause first?**
>
> <SEV tier> — <N> users, ongoing since <time>. Recommendation: <mitigate-first when user impact is ongoing and a rollback/flag path exists; root-cause-first when impact is contained, already mitigated, or no safe mitigation exists>.
```

Then `AskUserQuestion`:
- "Mitigate first — stop the bleeding, investigate after" → Phase 3
- "Root-cause first — impact is contained, find the cause now" → Phase 4
- "Both in parallel — I'll mitigate manually while orc investigates" → Phase 4, and append the user's manual mitigation steps to the timeline as they report them

### Phase 3 — Mitigate-first path

Present concrete mitigation options **as options, never as executed actions**. Build each from the evidence (suspect deploy, feature area, load signature):

1. **Rollback** — identify the suspect deploy (Phase 2 correlation). Name the exact target: "revert to `<sha>` / redeploy release `<version>`" and the project's actual deploy mechanism if discoverable (CI workflow, deploy script).
2. **Feature flag off** — if the code path behind the failing frames is flag-gated (`Grep` for flag names near the culprit), name the flag and the kill switch.
3. **Scale / shed load** — if the signature is saturation (timeouts, OOM, queue depth) rather than a code defect: scale replicas up, enable rate limiting, shed non-critical traffic.

For whichever option the user picks, show the danger preview BEFORE anything state-changing:

```markdown
> **🛑 Mitigation preview — NOT executed**
>
> Exact commands/steps below. /orc:incident does not run production mutations — you (or your deploy tooling) execute; orc records.
```

```
<the exact commands or console steps>
```

Then `AskUserQuestion`: "I ran it — record in timeline" / "Show a different option" / "Abort mitigation". **Never auto-execute production mutations — no deploys, no flag flips, no scaling calls — even if every binary is available.** When the user confirms execution, append the timeline row, then verify the bleeding stopped: re-run `sentry issue view <SHORT-ID> --json` and compare `lastSeen`/event rate, or ask the user for the dashboard reading. Record the verification in the timeline.

Once mitigated: bump checkpoint to phase=3-done and offer the root-cause path (Phase 4) — mitigation without root cause is a snooze button, not a fix.

### Phase 4 — Root-cause path

Dispatch the `orc-debug-investigator` subagent via `Task`. Pass it:
- Everything in `${ORC_STATE_DIR}/<branch>/files/incident/evidence.md` — Sentry event JSON, stack trace, blast-radius facts.
- The suspect-deploy correlation from Phase 2 (`git log` window).
- The current branch + recent commits (`git log -10 --oneline`).

The agent returns a written diagnosis: root cause, evidence, recommended fix surface, recommended regression test. Save it to `${ORC_STATE_DIR}/<branch>/files/incident/diagnosis.md` and append the finding (one line: root cause + file:line) to the timeline. Bump checkpoint to phase=4.

Print the Gate headline (`**⛔ Gate — diagnosis**`, one line on the root cause), then `AskUserQuestion`:
- "Diagnosis looks right — proceed to fix via /orc:debug discipline (regression test first, then fix)"
- "Need more investigation — re-dispatch with this hint: …"
- "Park it — incident is mitigated; fix ships later via /orc:debug or /orc:flow"

If fixing now: follow `/orc:debug` Phases 4–6 (TDD red regression test → `orc-code-fixer` → `orc:verification-before-completion`). Append test-written / fix-applied / suite-green rows to the timeline as they happen.

### Phase 5 — Stabilize + handoff

1. **Declare stable only with evidence**: error rate back to baseline (`sentry issue view` shows `lastSeen` stale / issue resolvable, or the user confirms the dashboard), mitigation or fix in place. Append the resolution row to the timeline with the UTC timestamp.
2. Mark the session `status: completed` in `.orc/orc.json`; bump checkpoint to phase=done with paths to `timeline.md`, `evidence.md`, and `diagnosis.md` (if produced).
3. **Offer the postmortem**, seeded with the timeline:

```markdown
> **➡️ Next**
>
> Incident stable. Run `/orc:postmortem <slug> --severity <sev-tier>` — its Phase 4 builds the timeline FIRST, and `.orc/<branch>/files/incident/timeline.md` is that timeline, already timestamped. Point it there instead of reconstructing from memory; `evidence.md` and `diagnosis.md` feed its root-cause phase.
```

`AskUserQuestion`:
- "Run /orc:postmortem now (seeded from the timeline)" — invoke it; during its Phase 4, `Read` the incident `timeline.md` and convert the rows into the postmortem timeline table (detection → response → mitigation → resolution), asking the user only to fill gaps. Pass the severity so its Phase 2 is a confirmation, not a proposal.
- "Later — the timeline file will be waiting"
- "Skip — no postmortem for this one" (SEV-1/SEV-2 without a postmortem: note in the timeline that one was declined)

## Iron rules

- **Timeline or it didn't happen.** Every pull, finding, mitigation, and verification appends a UTC row to `timeline.md` in the same turn it occurs — never batched at the end from memory.
- **No production mutations, ever.** Rollbacks, flag flips, and scaling are previewed (🛑) and user-executed. orc records; the human acts.
- **No "stable" claim without evidence** — a fresh Sentry read or an explicit user confirmation, recorded in the timeline.
- **Mitigation is not resolution.** After mitigate-first, always offer the root-cause path before closing.

## Output

- `.orc/<branch>/files/incident/timeline.md` — append-only UTC timeline (the postmortem seed)
- `.orc/<branch>/files/incident/evidence.md` — Sentry data / stack trace / blast radius
- `.orc/<branch>/files/incident/diagnosis.md` — when the root-cause path ran
- `.orc/<branch>/files/checkpoint.md` + session entry in `.orc/orc.json`
- Regression test + fix commits, when fixing during the incident
- Echoes: severity, blast radius, mitigation status, and the `/orc:postmortem` handoff line

## Resume

If interrupted between phases, `/orc:resume` reads the checkpoint and continues from the next pending phase. The timeline file carries the full history, so a resumed session re-reads `timeline.md` before acting.
