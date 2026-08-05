---
description: "Move tracker issues and external PRs through the triage state machine — categorise, verify the claim read-only, grill into shape when needed, and write agent-ready briefs; rejected enhancements land in the docs/agents/out-of-scope.md knowledge base. Use when triaging incoming issues, an external PR, or the backlog. Reads the tracker + label config written by /orc:setup."
argument-hint: "[<issue/PR number, Jira key, or natural-language request>]"
license: MIT
metadata:
  author: Matt Pocock
  source: Adapted from https://github.com/mattpocock/skills @ 2ffb184
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(gh:*)
  - Bash(acli:*)
  - Bash(jq:*)
  - Bash(git log:*)
  - Bash(git switch:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(go:*)
  - Bash(cargo:*)
  - Bash(pytest:*)
---

# /orc:triage

Move issues on the project tracker through a small state machine of triage roles: categorise → verify the claim → grill if needed → write an agent-ready brief, park it, or reject it.

If the tracker config treats external pull requests as a request surface, triage covers them too: **a PR is an issue with attached code** — same roles, same states, same machine, with the PR deltas marked below. Resolve a bare `#42` to an issue or PR per the tracker config.

## Phase 0 — Read the tracker layer

Read `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`. If either is missing, don't hard-fail — print:

> **⚠️ Caution — tracker layer not configured**
>
> `/orc:triage` reads the tracker choice and label vocabulary from `docs/agents/`. Run `/orc:setup` once to write them.

then `AskUserQuestion`: **Run /orc:setup now** (recommended — then return here) / **Continue this session with defaults** (GitHub Issues via `gh`, canonical label strings) / **Abort**.

Tracker dispatch:

- **GitHub** — issues and external PRs via `gh` (`orc:gh-cli`). PRs are in discovery scope only when the config's "PRs as a request surface" flag is `yes`; an explicitly named PR is always triaged regardless.
- **Jira** — work items via `acli` (`orc:jira-cli`); triage state is applied as Jira labels per `triage-labels.md`. External PRs, when in scope, are still read via `gh`.
- **Local markdown** — edit the `Status:` / `Category:` lines and `## Comments` sections in the issue files the config points at.

Also read `docs/agents/domain.md` and follow its consumer rules (glossary vocabulary, ADR awareness) for every codebase exploration below.

## Roles

Two **category** roles — `bug` (something is broken) and `enhancement` (new feature or improvement) — and five **state** roles:

- `needs-triage` — maintainer needs to evaluate
- `needs-info` — waiting on reporter for more information
- `ready-for-agent` — fully specified, ready for an AFK agent
- `ready-for-human` — needs human implementation
- `wontfix` — will not be actioned

For a PR the same states read against the attached code: `ready-for-agent` means a brief is attached and an agent should take the next step on the diff; `ready-for-human` means it's ready for a human to merge.

Every triaged item carries exactly one category role and one state role. Conflicting state roles → flag it and ask the maintainer before doing anything else. These are **canonical names** — the actual label strings come from `docs/agents/triage-labels.md`. Transitions: unlabeled → `needs-triage` → one of `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`; `needs-info` returns to `needs-triage` when the reporter replies. The maintainer can override any transition — flag unusual ones and ask.

## Invocation

The maintainer describes what they want in natural language; interpret and act:

- "Show me anything that needs my attention" → **attention queue**
- "Let's look at #42" / "look at PROJ-123" → **triage a specific item**
- "Move #42 to ready-for-agent" → **quick state override**
- "What's ready for agents to pick up?" → query and list

## Attention queue

Query the tracker and present three buckets, oldest first, with counts and a one-line summary per item:

1. **Unlabeled** — never triaged.
2. **`needs-triage`** — evaluation in progress.
3. **`needs-info` with reporter activity since the last triage notes** — needs re-evaluation.

When PRs are in scope, include external PRs tagged `[PR]` vs `[issue]`. Discovery surfaces only *external* PRs (the tracker config defines external — a collaborator's in-flight PR is not triage work); this filter is discovery-only. Let the maintainer pick.

## Triage a specific item

1. **Gather context.** Read the full item — body, comments, labels, author, dates; for a PR, the diff too. Parse prior triage notes so resolved questions aren't re-asked. Explore the codebase using the domain glossary, respecting ADRs in the area. Two checks: (a) **redundancy** — search for an existing implementation of the requested behavior by domain concept, not just the request's wording, and report where you looked; found → already-implemented `wontfix` (step 5). (b) **prior rejection** — read `docs/agents/out-of-scope.md` and surface any concept resembling this request (match by concept similarity, not keywords — "night theme" matches a Dark Mode entry).

2. **Recommend.** Print the Gate headline (`**⛔ Gate — triage recommendation**`, one line: category + state + why, per `orc:insights`), then `AskUserQuestion`: accept the recommendation / pick a different state / verify the claim first. Include a brief codebase summary relevant to the request — including whether it's already implemented.

3. **Verify the claim (read-only).** Before any grilling, check that the claim holds up — **investigate, don't fix**: no commits, no pushes, no tracker writes. For a bug, reproduce it from the reporter's steps. For a PR, check out the branch and confirm the diff does what it claims — run the relevant tests or commands, then switch back. Report: **confirmed** (with code path), **failed to reproduce**, or **insufficient detail** (a strong `needs-info` signal). A confirmed verification makes a much stronger agent brief.

4. **Grill (if needed).** If the request needs fleshing out, run `orc:grilling` and `orc:domain-modeling` together — grill it into shape a round at a time, sharpening domain terms and updating `CONTEXT.md`/ADRs inline as decisions land.

5. **Apply the outcome.** Print `**📋 Preview — tracker writes**` showing every label change, comment body, and close verbatim, then `AskUserQuestion` to confirm before touching the tracker:
   - `ready-for-agent` — post an agent brief comment (template below).
   - `ready-for-human` — same structure, plus one line on why it can't be delegated (judgment calls, external access, design decisions, manual testing).
   - `needs-info` — post triage notes (template below).
   - `wontfix` — close, with the comment depending on *why*:
     - **Already implemented** — point to where it lives; do **not** write to the out-of-scope KB (that's for rejected requests, not built ones).
     - **Rejected bug** — polite explanation, then close.
     - **Rejected enhancement** — record it in `docs/agents/out-of-scope.md`, link the entry from the closing comment, then close.
   - `needs-triage` — apply the role; optional comment if there's partial progress.

## Quick state override

"Move #42 to ready-for-agent" → trust the maintainer and apply directly. Still show the `**📋 Preview — tracker writes**` block (role changes, comment, close) and confirm, then act. Skip grilling. When moving to `ready-for-agent` without a grilling session, ask whether to write an agent brief.

## Agent briefs

The brief is the contract an AFK agent works from; the original body and discussion are only context. Principles:

- **Durable over precise** — the item may sit for weeks while the codebase moves. Describe interfaces, types, and behavioral contracts; never file paths or line numbers.
- **Behavioral, not procedural** — what the system should do, not how to implement it; the agent explores fresh.
- **Complete acceptance criteria** — each independently verifiable ("running `x` returns `y`", not "works correctly").
- **Explicit scope boundaries** — name what must NOT change, so the agent doesn't gold-plate.

For a PR, "Current behavior" describes the state of the diff, and the brief asks the agent to finish or fix it rather than build from scratch.

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** one line on what needs to happen

**Current behavior:**
What happens now — the broken behavior (bug) or the status quo (enhancement).

**Desired behavior:**
What should happen when the work is done. Be specific about edge cases and errors.

**Key interfaces:**
- `TypeName` — what needs to change and why
- `functionName()` — current vs desired contract

**Acceptance criteria:**
- [ ] Specific, testable criterion
- [ ] Specific, testable criterion

**Out of scope:**
- Thing that must NOT be changed in this issue
```

## Needs-info template

```markdown
## Triage Notes

**What we've established so far:**

- point 1

**What we still need from you (@reporter):**

- specific, actionable question — never "please provide more info"
```

Capture everything resolved during grilling under "established so far" so the work isn't lost.

## Out-of-scope knowledge base

`docs/agents/out-of-scope.md` is the persistent record of **rejected enhancements** — institutional memory (why it was rejected) plus deduplication (surface the prior decision instead of re-litigating). One `##` section per **concept** — titled so a skimmer knows what was rejected without reading — written like a short design note:

```markdown
## Dark Mode

This project does not support dark mode or user-facing theming.

**Why out of scope:** the rendering pipeline assumes a single palette resolved at
build time; theming is a downstream-consumer concern. Durable reasons only —
"too busy right now" is a deferral, not a rejection.

**Prior requests:** #42, #87
```

- **Check it** during step 1 of every triage; on a match, ask the maintainer: confirm (append the new item to Prior requests, close), reconsider (update/delete the entry, triage normally), or unrelated (triage normally).
- **Write it** only for rejected enhancements — never bugs, never already-implemented requests.
- The maintainer changing their mind → delete the entry; old closed items stay closed as history.

## Iron rules

- **No tracker write without the preview gate.** Every comment, label change, and close is shown verbatim and confirmed first.
- **Verify-the-claim is read-only.** Reproduce and run tests; never commit fixes from triage — that's `/orc:debug` or `/orc:flow` work, seeded by the brief.
- **No AI attribution** in any posted comment, brief, or close message.
- Session state lives **on the tracker** (triage-note comments), not in `.orc/` — resuming means re-reading the item's notes, checking what the reporter answered, and presenting an updated picture. No checkpoint to register.

## Output

- Tracker writes (labels, briefs, triage notes, closes) — each behind its preview gate
- `docs/agents/out-of-scope.md` entries for rejected enhancements
- Updated `CONTEXT.md`/ADRs when grilling resolved domain terms (via `orc:domain-modeling`)
