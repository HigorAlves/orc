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

Resolve the ticket: explicit `ticketKey`, else the active session's `jiraTicket` in `.orc/orc.json` (sanitized-branch match, `status == in_progress`) — the same resolution `/orc:jira bind` uses. **No ticket, or comment unavailable ⇒ no tracker target** (the gate still runs when the Artifact target below is available; otherwise skip to step 5).

**Report + Artifact target** (independent of the tracker): for a session packet, always render the report — `orc-report html` writes `qaDir/report.html` (criteria, notes, screenshots, recording; missing files flagged) and prints its path. The **Artifact** target is available iff the host exposes the `Artifact` tool.

Exact commands: `references/jira-adapter.md`. The tracker-agnostic interface (to add GitHub/Linear later): `references/adapter-contract.md`.

### 2. Curate the payload

**Prefer the manifest.** When `qaDir/qa-manifest.json` exists, its `curated` array IS the payload — the driver already picked the items that best prove the behavior; take them verbatim and add `steps.md`. Also read its `acceptance` rows: the comment body names each criterion and its result, so the ticket says what was proven rather than "QA passed".

No manifest (a hand-built packet) ⇒ fall back to the driver's packet shape:

- **Driver B (Chrome)** → `qa-<branch>.gif` + `steps.md`.
- **Driver A (agent-browser)** → the `ac-*.png` criterion shots + `qa-<branch>.webm` (or its `.gif`) + any failing-step shots + `steps.md`.

Attach `.webm`/`.gif`/`.png` alike — the REST upload path in `references/jira-adapter.md` is content-type agnostic. Never attach `console.log` / `network.har` / `network-summary.md` / `snapshot-final.txt` — noise on a ticket; they stay local. When **attach** is unavailable (comment tier only), the payload is comment-only — note it in the preview.

### 3. Preview gate — always ask

Emit the Preview callout, then `AskUserQuestion` (header `Publish`) with the payload as the `preview` of **Upload to `<KEY>`** — never inside the callout (blockquotes break alignment); fence fallback when `AskUserQuestion` is unavailable (`orc:gates` §3). No flag bypasses this — the tracker is outward-facing (hard-outward per `orc:using-orc`; `--auto`/`interaction_policy` never skip it).

```
> **📋 Preview — evidence for <KEY>**
```

Payload to show: the target ticket + URL, the curated file list (mark comment-only if no token), and the comment body verbatim. Options:

- **Upload to `<KEY>`** — attach the files (if able) + post the comment.
- **Keep local only** — record, send nothing.
- **Cancel** — do nothing.

If a prior `## Evidence delivery` block in `steps.md` already reads "uploaded", say so in the gate and make **Keep local only** the safe default — this is the double-upload guard.

Artifact target available ⇒ the same `AskUserQuestion` call carries a second question (header `Publish`): **Publish the QA report as a private Artifact?** — `Keep local (Recommended)` / `Publish privately` (preview: the report's criteria list + the files it would upload). With no tracker target it is the only question. A prior `Report: artifact <url>` line in `steps.md` ⇒ offer `Update that artifact` instead of a second URL.

### 4. Deliver — on Upload

- **Attach** each curated file over REST (acli has no upload verb — `references/jira-adapter.md`). A per-file failure ⇒ surface it and continue; partial delivery beats none.
- **Comment**: post the plain-text summary via `acli jira workitem comment create`. **Plain text only** — Jira stores rich text as ADF, so markdown renders literally; reference attachments by filename, never embed.

- **Artifact** (on Publish): publish `qaDir/report.html` with the `Artifact` tool (new artifact: `icon: checklist`; update: pass the recorded `url`). Upload every image/video the report references and that exists — `orc-report json | jq -r '[.artifacts[].file, .acceptance[].evidence[]] - .missing | map(sub("#.*"; "")) | unique | .[]'` — as `files`, each published at its bare filename so the report's relative paths resolve. Never include `console.log` / `network.har`. It stays private; linking it from a PR or ticket is a separate, asked step.

### 5. Record — provenance + idempotency

Append to `steps.md`:

```
## Evidence delivery — <ISO>
- Outcome: uploaded to <KEY> | kept local | no tracker enabled | cancelled
- Ticket: <KEY> (<url>)
- Attached: <file list | none (comment-only — set JIRA_API_TOKEN to attach) | none (local)>
- Comment: posted | n/a
- Report: <qaDir>/report.html | artifact <url>
```

Echo a one-line `✓` on upload, or a plain note otherwise. Local-only and cancel stay plain — no callout.

## Iron rules

- **Always ask before uploading.** No flag bypasses the preview gate — an Artifact publish included (hard-outward per `orc:using-orc`).
- **Never block on a missing tracker.** No acli / no auth / no ticket ⇒ local-only, one line, never an error.
- **Plain-text comments only.** Markdown/ADF pitfalls are documented in `references/jira-adapter.md`.
- **Record every outcome in `steps.md`** — provenance and the double-upload guard both live there.
