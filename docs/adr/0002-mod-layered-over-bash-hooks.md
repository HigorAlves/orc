# 0002 — The orc mod is a layer over the bash hooks, never a replacement

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** maintainer

## Context

Claude Code 2.1.287 introduced mods: in-process hook modules (`hooks/mod/register.ts`) that can rewrite events and draw UI. orc's guardrails (confirm-to-commit on protected branches, destructive-git gating, the AI-attribution deny, the dependency pre-flight) had lived since 0.1 as bash PreToolUse and SessionStart hooks. The mod could re-implement all of them with richer UX, and the 0.23.0 train had to decide whether it should.

Mods are unavailable in several real situations: older Claude Code, `--safe-mode`, `disableAllHooks`, an org policy, or the `mod_enabled: false` setting. The safety case in `docs/safety.md` is written against short, readable shell scripts anyone can audit in five minutes.

## Decision

Every guardrail stays in the bash hooks. The mod only adds what bash cannot do: attribution rewritten at the source so the deny never fires, compaction that keeps orc's place, the `/orc` cockpit, model profiles, the usage ledger, gate badges, and the CI watcher. With the mod absent or disabled, orc behaves identically on every iron rule.

## Alternatives considered

### Option A — Move the guards into the mod
- One implementation, richer prompts, no bash.
- Rejected: every environment without mods would lose the guardrails, and the safety case would rest on TypeScript running inside the harness instead of scripts a reviewer can read.

### Option B — Implement each guard twice
- Bash for fallback, mod for UX, kept in sync.
- Rejected: two sources of truth for the one thing that must not drift.

## Consequences

- **Positive:** the guardrail table in `docs/safety.md` stays true in every environment; the mod can be switched off with no behavioural change; `claude plugin validate` lists exactly what the mod hooks.
- **Negative:** some UX the mod could give the guards (a structured prompt instead of a permission dialog) is left on the table.
- **Neutral:** attribution is handled at two layers by design: the mod removes it before the bash guard would deny it.

## Follow-ups

- [x] `scripts/ci/verify-guard-hooks.sh` smoke-tests the bash guards independently of the mod.
- [ ] When mods become the only hook mechanism in a future Claude Code, revisit with this ADR as the predecessor.
