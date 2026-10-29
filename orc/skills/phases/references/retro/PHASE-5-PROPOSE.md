<!-- orc:retro/P5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 5 — Propose (`--propose` only)

Turns a finished session into calibration numbers and candidate rules for `docs/agents/project-context.md`. The arithmetic runs in `lib/retro.sh` (jq); the model writes only the rule lines.

`R` below means `bash "${CLAUDE_PLUGIN_ROOT}/lib/retro.sh"`; `F` means `${ORC_STATE_DIR}/<branch>/files`.

## Mechanics

1. Run `R missing F`. Print the skipped sources and continue without them.
2. Read `usage.jsonl`, `slices.json`, `decisions.json`, `qa-verdict.json`, `review-findings.json` and `ci-*.json` from `F`.
3. Run `R calibration F/slices.json` and keep the JSON.
4. Run `R incidents F <branch>` and write the result to `F/retro/incidents.json`.
5. Run `R patterns F/retro/incidents.json` plus every prior `.orc/*/files/retro/incidents.json`, and keep the result.

NOTE: one occurrence is an incident, two is a pattern. A pattern counts occurrences across this session and prior sessions.

## Rules

1. For each pattern, write one candidate rule: imperative, at most 20 words, project-specific.
2. Place each rule under `## Critical rules` or `## Conventions`.
3. If a linter or CI job can enforce the rule, propose that check instead of the rule.
4. Write `F/proposed-rules.md` as a fenced `diff` against the current `docs/agents/project-context.md` (an empty file when none exists).
5. Write `F/planning-calibration.json` as `{schema, estLocBias, sampleSize, generatedAt}` from step 3.
6. If there is no pattern, write the calibration file and skip the rules file.

## Gate

1. Ask with `AskUserQuestion`, previewing the diff. Options: apply, edit via notes, skip.
2. If the answer is apply, write `docs/agents/project-context.md`.
3. If the result exceeds 150 lines or 6 KB, refuse the write and name the lines to cut.
4. If the answer is edit, take the user's notes, rewrite the rules and ask again.
5. Do not commit. The user commits.

## Limits

- Write only under `.orc/` and `docs/agents/project-context.md`.
- Make no tracker write.
