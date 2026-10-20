# 0005 — Em-dashes and quoted descriptions as the house punctuation

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** maintainer

## Context

mattpocock/skills, which fifteen orc skills are vendored from, removed every em-dash from its prose in 1.3.0 and bans the character in `CLAUDE.md`, rewriting each sentence with a comma, colon, period, or conjunction. The stated reason is readability as plain text. The sweep had a side effect: six descriptions that gained an unquoted colon-space became invalid YAML and silently stopped loading until a follow-up quoted them.

orc's skill-writing rules go the other way: the em-dash is the preferred inline separator precisely because it avoids the colon-space trap in single-line YAML descriptions, and any description that must contain `: ` is double-quoted. The alignment train of 2026-10-20 had to decide whether to follow the upstream purge across 84 skills, 32 commands, and 14 agents.

## Decision

Skill, command, and agent prose keeps the em-dash as its inline separator. Descriptions containing colon-space are quoted. Upstream's punctuation changes are not mirrored when a skill is resynced; only substantive changes are.

User-facing terminal output and PR bodies follow their own writing rules and are not governed by this ADR.

## Alternatives considered

### Option A — Adopt the purge
- Mirror upstream exactly, so future diffs are smaller.
- Rejected: the change is punctuation with no behavioural claim behind it, across roughly 130 files, and it re-creates the YAML trap the house rule exists to avoid. The resync cost is already paid by filtering punctuation-only hunks out of the upstream diff.

### Option B — Ban em-dashes in new files only
- Rejected: two conventions in one repo is worse than either.

## Consequences

- **Positive:** no churn; the YAML rule stays simple (quote when there is a colon-space, prefer the dash otherwise); resyncs compare substance, not characters.
- **Negative:** vendored skills drift from upstream byte-for-byte, so a `diff` against upstream is never clean; provenance frontmatter records the pin instead.
- **Neutral:** `docs/agents/out-of-scope.md` records the rejected purge so it is not re-proposed.

## Follow-ups

- [ ] If a model is ever observed to read the em-dash worse than a comma in a skill body, measure it with the eval suite before reopening this.
