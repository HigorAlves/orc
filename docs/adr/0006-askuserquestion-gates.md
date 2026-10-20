# 0006 — Gates run on `AskUserQuestion`, not plain-text questions

- **Status:** Accepted
- **Date:** 2026-08-20
- **Deciders:** maintainer

## Context

mattpocock/skills asks every grilling question as plain chat text and records, in its out-of-scope knowledge base, that routing questions through a harness's native question tool is rejected: the skills must run on Claude Code, Codex, Copilot, Cursor, and Gemini, each with a different question tool or none, and structured pickers push the model toward multiple-choice questions with pre-baked answers.

orc runs on one harness. Its multi-phase commands pause at gates, and 0.19.0 classified them (hard-outward, soft-inward, escalation-only) and put an autopilot ladder on the soft-inward ones. That classification needs a gate the code can see: a question with a header chip, a recommended-first option list, an optional preview, and multiSelect chunks for batch decisions.

## Decision

Every orc gate is an `AskUserQuestion` call shaped by `orc:gates`: a header chip naming the class, the recommended option first, a `preview` for preview-then-confirm, multiSelect chunks of four for batch picks, and rewrites riding the notes. The grilling engine (`orc:grilling`, vendored) keeps its plain-text rounds, because an open question answered in the user's own words is the point of grilling; the gates around it are structured.

## Alternatives considered

### Option A — Plain-text gates, harness-neutral
- The upstream stance.
- Rejected: orc is not harness-neutral, and a gate the model asks in prose cannot be badged, previewed, pre-approved by the autopilot ladder, or recognised by the mod.

### Option B — Structured grilling too
- Every question a picker.
- Rejected for the same reason upstream gives: pickers collapse open questions into pre-baked choices. Grilling stays prose; gates are structured.

## Consequences

- **Positive:** the gate class is machine-visible, so `interaction_policy` can skip the right ones and the mod can badge outward gates; batch decisions take one call instead of fifteen.
- **Negative:** orc's commands do not run outside Claude Code; `docs/agents/out-of-scope.md` records multi-harness support as rejected.
- **Neutral:** when `AskUserQuestion` is unavailable (headless), `orc:gates` specifies the fenced-text fallback.

## Follow-ups

- [x] `orc:gates` §1–§7 is the rendering contract; `verify-*` scripts do not lint it yet.
- [ ] An eval case that checks a gate's header chip and recommended-first order.
