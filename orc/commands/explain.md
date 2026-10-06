---
description: Build a narrated "what was made" walkthrough from a QA packet — golden-path demo clips (Playwright, overlays off) + animate motion graphics + local kokoro-js voice, assembled by orc-explain; one preview gate before render; delivered via the evidence-publish gates. Use after /orc:qa passes or on any .orc evidence packet.
argument-hint: "[--qa-dir <dir>] [--target <name>] [--style <animate-style>] [--voice <kokoro-voice>] [--auto[=guided|full]]"
allowed-tools:
  - Bash(orc-state:*)
  - Bash(orc-report:*)
  - Bash(orc-explain:*)
  - Bash(orc-qa-video:*)
  - Bash(orc-targets:*)
  - Bash(orc-playwright:*)
  - Bash(npx playwright:*)
  - Bash(orc-workspace-detect:*)
  - Bash(git log:*)
  - Bash(git branch --show-current:*)
  - Bash(jq:*)
  - Bash(ffprobe:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
effort: medium
---

# /orc:explain

Turn a QA packet into a short narrated walkthrough of what was built and proven: demo footage of the golden path, motion-graphic title/callout/outcome segments, one voice track. Everything renders locally (kokoro-js, ffmpeg, optional animate plugin). Nothing is uploaded without the evidence-publish gates.

## Arguments

- `--qa-dir <dir>` — packet to explain. Default: the active session's `${ORC_STATE_DIR}/<sanitized-branch>/files/qa/`; else the newest `.orc/evidence/*/` packet; else ask.
- `--target <name>` — target for the demo pass when the packet has no `demo/` clips (`orc:qa-targets`); default: the session's settled `target`.
- `--style <s>` — animate style (`cut-paper|crosshatch|riso|sketchbook|math|pixel|isometric`); default userConfig `explainer_style`.
- `--voice <v>` — kokoro voice id; default userConfig `explainer_voice` (`af_heart`; `pf_dora` for pt-BR).
- `--auto[=guided|full]` — autopilot (`orc:gates` §6). Pre-approves the Explainer gate; delivery gates always ask.

## Workflow

### Phase 0 — Context
!`orc-workspace-detect --banner`
Resolve the packet dir (above). `qa-manifest.json` missing ⇒ stop: `🛑 No QA packet — run /orc:qa first`.

### Phase 1 — Build
Invoke `orc:explainer` with the packet dir, the plan path when the session has one, the resolved target JSON (only if the demo pass is needed), style, voice. It runs the demo pass if needed, writes `explain/segments.json`, runs the **Explainer gate**, narrates, authors the animate scenes (when animate is installed), renders `explainer-<branch>.mp4`, and updates the manifest + `steps.md`.

### Phase 2 — Deliver
Invoke `orc:evidence-publish` with `qaDir`, the manifest verdict, and `explainerFile`. Its questions (Jira upload / private Artifact / PR comment) are hard-outward — always asked. Keep-local is the default.

### Phase 3 — Record
Session present ⇒ `orc-state digest write -` with `Explainer: explainer-<branch>.mp4 (<seconds>s)` and append `## Explainer — <ISO>` to `progress.md`.

## Iron rules
- No render without the Explainer gate (unless `--auto`); no upload without the publish gates.
- The script never quotes code or file names and never includes credentials.
- Missing ffmpeg ⇒ one line, stop. Missing animate ⇒ title cards, continue, say so.
