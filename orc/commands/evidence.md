---
description: Collect browser evidence scoped to a ticket (or shared context) and deliver it — drives Chrome (Claude-in-Chrome) or agent-browser to navigate + screenshot, writes a .orc evidence packet, then uploads it to the ticket or keeps it local (always asks). For proving a ticket's behavior without a code diff/PR. Workspace-aware.
argument-hint: "[<TICKET-KEY>] [--web <url>] [--driver chrome|agent-browser] [--context \"<what to test>\"] [--no-env] [--repos a,b | --repo a | --this-repo]"
arguments: [ticket]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(orc-workspace-detect:*)
  - Bash(orc-docker-env:*)
  - Bash(acli:*)
  - Bash(curl:*)
  - Bash(jq:*)
  - Bash(git branch --show-current:*)
  - Bash(agent-browser:*)
  - Bash(npx agent-browser:*)
---

# /orc:evidence

Collect browser evidence that a ticket's behavior works — navigate, screenshot, record — then deliver it to the ticket or keep it local. Unlike `/orc:qa` (a pre-PR gate scoped to your **diff** that also runs tests/lint), this is scoped to a **ticket** (or a flow you describe) and does only the evidence loop. Use it to attach proof to a ticket, demo a flow, or QA a ticket you didn't necessarily write the code for.

Collection **reuses `/orc:qa`'s browser drivers verbatim**; delivery reuses the `orc:evidence-publish` skill. This command is only the ticket-first orchestrator — it invents no new browser or upload logic.

## Arguments

- `<TICKET-KEY>` — the ticket to scope from and (on upload) deliver to. Omit to use the session's bound `jiraTicket`, or to run context-only.
- `--context "<what to test>"` — describe the flow to exercise, instead of (or on top of) pulling it from the ticket.
- `--web <url>` — app already running at this URL; skip env provisioning.
- `--driver chrome|agent-browser` — browser driver; default is the same Phase 4.1 gate as `/orc:qa`. `chrome` = Claude-in-Chrome, watch live in your browser; `agent-browser` = headless CLI validator.
- `--no-env` — skip Docker provisioning; use `--web` or a legacy boot.
- Workspace flags (`--repos`/`--repo`/`--this-repo`) — as in `/orc:qa`.

## Workflow

### Phase 0 — Context + ticket

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars exported; don't re-run detection). Resolve the target ticket: positional `<KEY>` → session's bound `jiraTicket` (`.orc/orc.json`, sanitized-branch match) → `AskUserQuestion`: `Provide a key` / `Run context-only (save locally, no delivery)` / `Cancel`. A key is optional — context-only runs still collect and save the packet, just with no delivery target.

### Phase 1 — Scope the run

Build the golden-path scope from, in precedence order: `--context`, the ticket body, both. When a key resolved and `acli jira auth status` exits 0:

```bash
acli jira workitem view "<KEY>" --fields "summary,description" --json \
  | jq -r '.fields.summary, (.fields.description // "")'
```

Distill the summary + acceptance criteria into a short list of expected behaviors — that list is the "feature description" the browser drivers consume. If acli isn't available, rely on `--context` / the conversation; if neither exists, `AskUserQuestion` for what to test.

### Phase 2 — Environment

Same as `/orc:qa` Phase 4.0 (do **not** duplicate the logic): `orc-docker-env is-ready $(orc-docker-env state-path "$ORC_STATE_DIR" <sanitized-branch>)` → `ready` attaches (echo the reuse line); otherwise dispatch **`orc-env-provisioner`** via `Task`. Skip on `--web` / `--no-env`. Record `appUrl`. The environment stays up after the run (teardown is `/orc:cleanup`).

### Phase 3 — Collect

Pick the packet directory: an active branch session → `${ORC_STATE_DIR}/<sanitized-branch>/files/qa/`; no session → `.orc/evidence/<sanitized-KEY>/` (context-only → `.orc/evidence/adhoc-<sanitized-context>/`). Then run the driver:

- Choose it from `--driver`, else the **Phase 4.1 driver gate from `/orc:qa`** (`⛔ Gate — browser driver`).
- **Driver `chrome`** — follow `/orc:qa` **Driver B** verbatim: load the Claude-in-Chrome tools via one `ToolSearch`, call `tabs_context_mcp` first (if the extension isn't connected, say so and fall back to `agent-browser` — never silently), open a **new** tab, start a `gif_creator` recording named `qa-<sanitized-branch>.gif`, narrate each step, avoid `alert`/`confirm` elements.
- **Driver `agent-browser`** — dispatch **`orc-qa-validator`** (Driver A) with the Phase 1 scope as the feature description + `appUrl` + the packet dir.

Walk the scoped golden path plus any reachable edge cases, and write the packet exactly as `/orc:qa`'s Iron-rule table requires (visual proof + `snapshot-final.txt` + `console.log` + network + `steps.md`). Verdict: `pass|fail|partial`.

### Phase 4 — Deliver

Invoke `orc:evidence-publish`, passing `qaDir` (the packet dir), the resolved `ticketKey` (if any), and the `verdict`. It detects tracker enablement, curates the visual proof, runs the always-ask preview gate (Upload / Keep local / Cancel), and records the outcome in `steps.md`. No ticket / not authed ⇒ it degrades to a one-line "kept local" note.

### Phase 5 — Record

If an `.orc` branch session exists, append a `## Evidence — <ISO-timestamp>` line to `progress.md` (verdict + delivery outcome + packet dir) and bump `checkpoint.md`. Context-only ad-hoc runs skip this — there's no session to checkpoint.

## Iron rule

No "evidence collected" claim without the full packet `/orc:qa`'s Iron rule requires. Delivery is **always** the user's explicit choice via `orc:evidence-publish` — this command never auto-uploads.

## Output

- Evidence packet in `.orc/<branch>/files/qa/` or `.orc/evidence/<KEY>/`
- Delivery outcome (uploaded / kept local) recorded in `steps.md`
- Verdict echoed to the user
