---
name: tracker-config
description: The shared read-protocol and missing-config gate for the repo's tracker layer (docs/agents/issue-tracker.md, triage-labels.md, domain.md). Use when a command needs the configured tracker, its labels, or the Jira-enabled answer — /orc:setup writes the files; this skill reads them.
---

# Tracker Config

One read-protocol and ONE missing-config gate, shared by every tracker-aware surface (`/orc:triage`, `/orc:wayfinder`, `orc:to-issues`, the Jira link prompts in `/orc:plan|flow`, the Jira adapters). `/orc:setup` writes the layer; nothing else re-implements the detection or the gate.

## Read protocol

1. Read `docs/agents/issue-tracker.md` (repo root; in workspace mode, the target repo's). Present → parse the tracker choice + conventions; **no gate**. Also read `triage-labels.md` when the caller needs labels.
2. Missing → check the session's settled decisions first: `orc-state decision get trackerDefaults` — a prior "use defaults" answer means proceed with defaults silently (this is why the gate fires at most once per session).
3. Still unsettled → the one canonical gate:

```markdown
> **⛔ Gate — tracker layer not configured**
>
> docs/agents/issue-tracker.md is missing — tracker-aware behavior needs it.
```

`AskUserQuestion`:
- **Run /orc:setup now** — the interview writes the layer, then the calling command continues.
- **Continue with defaults** — GitHub Issues when `gh` is authenticated, else local markdown. Record it: `orc-state decision set trackerDefaults <choice> --provenance asked` — no tracker-aware command asks again this session.
- **Abort.**

## The Jira-enabled answer

"Does this repo use Jira?" is read, never asked: the tracker layer declares it (`issue-tracker.md` names Jira as the tracker, or a Jira project key is recorded). **When the layer says no Jira, Jira-link prompts are dropped silently** and the session records `orc-state decision set jiraTicket none --provenance inferred` — asking about an unconfigured tracker is noise.

## Seed templates (consumed by /orc:setup)

`/orc:setup` Phase 4 reads ONLY the chosen tracker's template from [references/templates/](references/templates/GITHUB.md) — `GITHUB.md`, `JIRA.md`, `LOCAL.md`, plus `TRIAGE-LABELS.md` and `DOMAIN.md` — fills the bracketed slots, and trims sections that don't apply. "Other" trackers: write `issue-tracker.md` from scratch out of the user's description, keeping the same headings.
