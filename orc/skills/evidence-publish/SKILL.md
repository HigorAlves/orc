---
name: evidence-publish
description: "Deliver a QA/evidence packet to a tracker or keep it local, behind an always-ask preview gate. Protocol for /orc:qa Phase 6, /orc:evidence, and any evidence-delivery step."
---

# Evidence Publishing

Take the evidence packet browser QA already wrote to `.orc/<branch>/files/qa/` and deliver it: attach the visual proof and post a summary to the linked ticket, or keep it local — always the user's explicit choice, and always safe to run (no tracker ⇒ local-only, no prompt, no error).

**Announce at start:** "I'm using the evidence-publish skill to deliver the QA evidence."

Collection is NOT this skill's job — `/orc:qa` (Driver A `agent-browser` / Driver B Claude-in-Chrome) already produced the packet. This skill owns delivery only: **detect → curate → preview-gate → deliver → record.**

## Inputs

- `qaDir` — the packet directory (`.orc/<branch>/files/qa/` or `.orc/evidence/<KEY>/`).
- `ticketKey` (optional) — an explicit key; else resolved from the active session.
- `verdict` — `pass|fail|partial` from the QA run (used in the comment).

## Protocol

### 1. Detect — tracker enablement ladder

Two capability tiers, checked and degraded **independently**:

- **comment** available iff `command -v acli` **and** `acli jira auth status` exits 0.
- **attach** available iff comment is available **and** `command -v curl` **and** a token env is set (`JIRA_API_TOKEN` or `ATLASSIAN_API_TOKEN`). Site + email are read from `acli jira auth status`; acli deliberately never exposes its stored token, so REST upload needs the user's own.

Resolve the ticket: explicit `ticketKey`, else the active session's `jiraTicket` in `.orc/orc.json` (sanitized-branch match, `status == in_progress`) — the same resolution `/orc:jira bind` uses. **No ticket, or comment unavailable ⇒ local-only** (skip to step 5, no gate).

Exact commands: `references/jira-adapter.md`. The tracker-agnostic interface (to add GitHub/Linear later): `references/adapter-contract.md`.

### 2. Curate the payload

**Prefer the manifest.** When `qaDir/qa-manifest.json` exists, its `curated` array IS the payload — the driver already picked the items that best prove the behavior; take them verbatim and add `steps.md`. Also read its `acceptance` rows: the comment body names each criterion and its result, so the ticket says what was proven rather than "QA passed".

No manifest (a hand-built packet) ⇒ fall back to the driver's packet shape:

- **Driver B (Chrome)** → `qa-<branch>.gif` + `steps.md`.
- **Driver A (agent-browser)** → the `ac-*.png` criterion shots + `qa-<branch>.webm` (or its `.gif`) + any failing-step shots + `steps.md`.

Attach `.webm`/`.gif`/`.png` alike — the REST upload path in `references/jira-adapter.md` is content-type agnostic. Never attach `console.log` / `network.har` / `network-summary.md` / `snapshot-final.txt` — noise on a ticket; they stay local. When **attach** is unavailable (comment tier only), the payload is comment-only — note it in the preview.

### 3. Preview gate — always ask

Emit the Preview callout, then the payload **outside** it (blockquotes break alignment), then `AskUserQuestion`. No flag bypasses this — the tracker is outward-facing (hard-outward per `orc:using-orc`; `--auto`/`interaction_policy` never skip it).

```
> **📋 Preview — evidence for <KEY>**
```

Payload to show: the target ticket + URL, the curated file list (mark comment-only if no token), and the comment body verbatim. Options:

- **Upload to `<KEY>`** — attach the files (if able) + post the comment.
- **Keep local only** — record, send nothing.
- **Cancel** — do nothing.

If a prior `## Evidence delivery` block in `steps.md` already reads "uploaded", say so in the gate and make **Keep local only** the safe default — this is the double-upload guard.

### 4. Deliver — on Upload

- **Attach** each curated file over REST (acli has no upload verb — `references/jira-adapter.md`). A per-file failure ⇒ surface it and continue; partial delivery beats none.
- **Comment**: post the plain-text summary via `acli jira workitem comment create`. **Plain text only** — Jira stores rich text as ADF, so markdown renders literally; reference attachments by filename, never embed.

### 5. Record — provenance + idempotency

Append to `steps.md`:

```
## Evidence delivery — <ISO>
- Outcome: uploaded to <KEY> | kept local | no tracker enabled | cancelled
- Ticket: <KEY> (<url>)
- Attached: <file list | none (comment-only — set JIRA_API_TOKEN to attach) | none (local)>
- Comment: posted | n/a
```

Echo a one-line `✓` on upload, or a plain note otherwise. Local-only and cancel stay plain — no callout.

## Iron rules

- **Always ask before uploading.** No flag bypasses the preview gate.
- **Never block on a missing tracker.** No acli / no auth / no ticket ⇒ local-only, one line, never an error.
- **Plain-text comments only.** Markdown/ADF pitfalls are documented in `references/jira-adapter.md`.
- **Record every outcome in `steps.md`** — provenance and the double-upload guard both live there.
