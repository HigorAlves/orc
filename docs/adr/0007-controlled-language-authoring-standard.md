# 0007 — Controlled-language authoring standard for agent-facing files

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** maintainer

## Context

orc's commands, agents and skills are procedures a model performs with no shared context beyond the file. That is the situation aircraft maintenance manuals solve with ASD-STE100 (one word, one meaning; procedural steps of at most 15 words in the imperative; one action per step; an unapproved-word list) and S1000D (small self-contained data modules with a code, stored once and reused). Issue #115 recorded both.

Measured on 2026-10-20 across 130 files: 2,686 procedural steps, 39% over 15 words, 334 over 30; 276 steps not opening with a verb; 396 passive lines; 117 unapproved words, 75 of them "should". The largest command entry was 17 KB and two agents exceeded 13 KB. The plugin projected about 11,700 always-on tokens per session. Upstream mattpocock/skills, the reference for small composable skills, scores worse on the same lint.

Long, hedged, passive steps are where a model's behaviour varies between runs. The cost is paid on every invocation.

## Decision

Every orc file follows the authoring standard in `orc/skills/skill-writing/references/AUTHORING-STANDARD.md`: the glossary as restricted vocabulary, a fixed unapproved-word list, 15 words per procedural step and 20 per descriptive sentence, verb-first imperative steps, WARNING / CAUTION / NOTE mapped onto the callout palette and placed before the step, a fixed task anatomy for commands, and phase modules with a code under `orc:phases`.

`scripts/ci/verify-ste.sh` enforces it as a ratchet: unapproved words fail outright; for existing files the long-step, non-imperative, passive, byte and description counts may only fall; new files meet the caps (command 6 KB, agent 8 KB, skill 6 KB without references) outright. The ten worst files are rewritten in the train that lands this ADR; the rest improve as they are touched.

## Alternatives considered

### Option A — Adopt upstream's prose style
- Shorter files by deletion, no limits.
- Rejected: upstream's own prose fails the same lint; style without a measure drifts back.

### Option B — Hard-fail every rule on day one
- Rejected: it blocks every PR until all 130 files are rewritten, and a rewrite that large is itself a quality risk. The ratchet gets the same end state without a freeze.

### Option C — Relaxed limits (20 / 30 words)
- Rejected: STE's limits are the tested ones; a step that needs more words needs a second step or a NOTE.

## Consequences

- **Positive:** steps the model can perform without interpretation; smaller always-on and on-invoke token cost; one place to split a long procedure (a module) instead of a longer file.
- **Negative:** terse prose reads curt to a human; file paths and flags push steps over the limit and must move to a NOTE; a heuristic lint has false positives that the baseline absorbs.
- **Neutral:** vendored skills are not rewritten (ADR 0005); the lint ratchets them like any other file.

## Follow-ups

- [ ] Rewrite the ten worst files (precision train, wave 2).
- [ ] Record the eval pass rate before and after each rewrite; a routing regression reverts the rewrite, not the standard.
- [ ] Revisit the limits only with eval evidence.
