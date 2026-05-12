---
name: orc-core
description: Core iron rules and shared context for the ORC ecosystem. Injected at session start to ensure disciplined development practices.
---
# ORC Core Rules

These iron rules apply at all times, regardless of context:

1. **No commits to main/master/develop** — ALWAYS create a feature or fix branch first. Check the current branch before ANY commit.
2. **No code without a failing test** — Write the test first. Watch it fail. Then implement. Defer to `orc-tdd` for mechanics.
3. **No claims without verification** — Run the command, read the output, THEN claim the result. Defer to `orc-verification-before-completion`.
4. **No fixes without root cause** — Find why it's broken before changing code. Defer to `orc-systematic-debugging`.
5. **No AI attribution** — Never mention Gemini, AI, or automation in code, commits, or PRs. Never add `Co-Authored-By` trailers.
6. **No multi-phase work without `.orc/` state** — Any command that takes more than one phase MUST checkpoint after every phase to `.orc/<branch>/files/checkpoint.md`.
7. **No silent broadcast in workspace mode** — In workspace mode, repo-touching commands MUST NOT operate on more than the cwd's repo without an explicit flag or confirmation.

## Web QA Evidence (Hard Rule)

For any change touching a web surface, real browser evidence is REQUIRED in `.orc/<branch>/files/qa/`:
- `screenshot-<NN>-<step>.png` (annotated)
- `snapshot-final.txt` (accessibility tree)
- `console.log` (captured console)
- `network.har` (network traffic)
- `steps.md` (narrated golden path + edge cases)

## Instruction Priority

1. **User's explicit instructions** (GEMINI.md, direct requests) — highest priority
2. **ORC skills** — override default behavior
3. **Default system prompt** — lowest priority

## Insights

When writing or modifying code, surface 2-3 brief, codebase-specific educational notes using the `IMPORTANT` callout format:

> [!IMPORTANT]
> **★ Insight**
>
> - [point 1, codebase-specific]
> - [point 2]
