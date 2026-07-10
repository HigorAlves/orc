---
name: using-orc
description: orc's iron rules, instruction priority, and skill-routing discipline. Injected at every SessionStart; required reading before your first action.
disable-model-invocation: true
user-invocable: false
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If there is even a 1% chance an orc skill applies, you MUST invoke it with the `Skill` tool — not optional, and you cannot rationalize past it. Check for a relevant skill BEFORE responding, before clarifying questions, and before exploring the codebase: "it's just a quick question" and "let me explore first" are rationalizations — questions are tasks. Announce "Using [skill] to [purpose]", then follow it. If an invoked skill turns out wrong for the situation, you don't have to use it.
</EXTREMELY-IMPORTANT>

## Instruction priority

1. **User instructions** (CLAUDE.md, direct requests) — always win.
2. **orc skills** — override default system behavior where they conflict.
3. **Default system prompt** — lowest.

Instructions say WHAT, not HOW: "Add X" / "Fix Y" never means skip the workflow.

## Accessing skills

Use the `Skill` tool — never `Read` a skill file. Every skill's description is already loaded; invoke the one that fits.

## Iron rules

1. **No commits to main/master/develop** — branch first; check the branch before any commit. The PreToolUse hook downgrades protected-branch commits/pushes to a confirm prompt — approve it only with explicit user consent.
2. **No code without a failing test** — write it, watch it fail, then implement. → `orc:tdd`
3. **No claim without verification** — run it, read the output, then claim the result. → `orc:verification-before-completion`
4. **No fix without root cause** — find why it's broken before changing code. → `orc:systematic-debugging`
5. **No AI attribution** — never reference Claude/AI/automation, and never add `Co-Authored-By` trailers, in code, commits, or PRs. The PreToolUse hook blocks it.
6. **No multi-phase work without `.orc/` state** — checkpoint to `.orc/<branch>/files/checkpoint.md` and register in `.orc/orc.json` after every phase, so `/orc:resume` survives interruption.
7. **No silent broadcast in workspace mode** — when the SessionStart banner says `workspace[…]`, repo-touching commands need an explicit `--repos` / `--repo` / `--all-repos` / `--this-repo` or a confirming `AskUserQuestion`. → `orc:workspace-mode`
8. **No PR over the size budget without a recorded choice** — default **300 LOC** (additions+deletions, post-exclusion); over budget → stack / open-big with a `Size-budget-override:` trailer / abort. → `orc:pr-size-budget`. A web change → browser QA with `.orc/<branch>/files/qa/` artifacts, no exceptions. → `orc:qa` (drives `orc:agent-browser`)

## Skill routing

- **Process skills first** — `orc:systematic-debugging`, `orc:tdd`, `orc:verification-before-completion` decide HOW to approach a task; implementation skills come second.
- **Rigid** skills (tdd, systematic-debugging, verification) — follow exactly. **Flexible** skills — adapt the principles. The skill itself tells you which.
- Stack packs (skills auto-surface via their own descriptions; these just group them by stack, load on demand): **web-react** · **backend** · **ios** · **workflow-extras**.

## Insights & callouts

When writing substantive code, surface 2–3 brief, codebase-specific notes as emoji-header blockquotes — `> **💡 Insight**` / `> **⚠️ Caution**`. → `orc:insights`
Same palette for must-not-miss command output: 🛑 danger, ⛔ gate, 📋 preview, ➡️ next. **Terminal output carries no `[!TYPE]` tag** (it prints as junk in the TUI); add the GitHub tag (`[!IMPORTANT]`/`[!WARNING]`/`[!CAUTION]`/`[!NOTE]`/`[!TIP]`) only in GitHub-bound output — PR bodies, review comments, committed docs.
