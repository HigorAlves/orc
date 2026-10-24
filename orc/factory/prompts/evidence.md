# EVIDENCE STAGE — assemble the QA packet (no model)

This stage runs no model: the pack has `agent: null`, so `run.mjs` does the work itself. This file documents what the script does; `{{agent}}` is `script`, attempt {{attempt}}, branch `{{task.branch}}`.

## Task
{{task.title}}

## What the script does
1. Scans `/out/files/` and lists every file as an artifact with its `sha256` (kinds: qa-manifest, screenshot, video, har, report, rules).
2. Reads `files/qa/qa-manifest.json`. Outcome is `pass` when its `verdict` is `pass` or `skipped`; `fail` for `fail`, `partial`, a missing manifest or an unreadable one.
3. Writes `/out/result.json`. The Hardness side attaches the artifacts to the task and publishes.

## Rules
- No model call, no AskUserQuestion, no network.
- Reads `/out` only; never touches `/work`.
