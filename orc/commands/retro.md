---
description: "Retrospective on a coding session — proposes changes to the agent's environment (navigation pointers, automated checks, coding standards, steering files, tool economy, information access), most severe first; applies accepted in-repo changes and files the rest through the tracker gate. Use after a build or a debug session, especially one that went sideways."
argument-hint: "[--session <branch>] [--transcript <path>] [<what to look back on>]"
license: MIT
metadata:
  author: Matt Pocock
  source: Adapted from https://github.com/mattpocock/skills @ 5beb35b
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git log:*)
  - Bash(git diff:*)
  - Bash(git branch --show-current:*)
  - Bash(gh issue create:*)
  - Bash(gh issue list:*)
  - Bash(acli jira workitem create:*)
  - Bash(jq:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:retro

Look back at a coding session and improve the **environment** the next session runs in — not the code it produced. A retro's output is a navigation pointer, a lint rule, a CI job, a coding standard, a slimmer steering file, a log the agent could not see. The code review already judged the code; this judges what made the code hard to get right.

Where it sits: the last step of the main flow (`/orc:flow` Phase 9 and `/orc:debug` offer it), and a standalone reach-for-it-anytime after a session that went sideways.

## Arguments

- `--session <branch>` — look back at that `.orc/<branch>/` session instead of the current one.
- `--transcript <path>` — a session log on disk to read as a primary source (after `/clear`, the conversation is gone; point here instead).
- `<what to look back on>` — free text narrowing the retro ("the three red slices", "why QA took 40 minutes").

## Workflow

### Phase 0 — Yardstick

Invoke `orc:writing-for-agents` **every run**, not only before writing: it defines what a no-op instruction is and what a good steering file looks like, and Phase 2 judges steering files against it before anything is written.

### Phase 1 — Primary sources

Read the session itself, never a summary of it. In order of signal:

1. `${ORC_STATE_DIR}/<branch>/files/` — `checkpoint.md` (phases, digest), `progress.md` (the slice-by-slice history), `slices.json` (which slices went red more than once, which escalated), `diagnosis.md`, `qa/steps.md`, `review-findings.json`. `orc-state usage summary` gives per-agent tokens and wall time, costliest first.
2. `git log --no-merges <base>..HEAD` for the branch — commit count, fixups, reverts, "retry" subjects are all evidence.
3. The current conversation (default) or `--transcript`.
4. The repo's own guardrails: its `package.json` or build-tool `lint`, `check`, `test` scripts, pre-commit config, and CI workflows. Read them before proposing a check — a check that exists but sits unwired or silently broken is the finding, not a reinvention.

No session state found → say so and work from the conversation and git log alone.

### Phase 2 — Candidates

Hunt in these categories. Each carries its own trigger; skip a category whose trigger did not fire — an empty retro is a valid retro.

- **Navigation** — how hard was it to find the right files? Hidden dependencies between files? Would a **navigation pointer** (one line in `CLAUDE.md` / `AGENTS.md` naming a doc) have saved the search? _Trigger:_ the session spent a long stretch locating one piece of information, or a Graphify graph was absent where `orc:code-discovery` would have paid off.
- **Automated checks** — is there a check that would have caught a mistake the agent made? Linting, typing, tests, filesystem linters. A repo with **no guardrail at all** (no pre-commit hook and no CI job running its lint/typecheck/test command) is itself a finding: an un-linted repo is a standing missed opportunity, not a neutral default. _Trigger:_ a mistake a deterministic check could have caught, or no guardrail exists.
- **Coding standards** — should the reviewer be given a new rule, or an existing one removed or clarified? **Classify the violation first.** A **mechanical** one (a fixed syntactic pattern, a banned API, an import shape, a file-location rule) gets a deterministic check, full stop: a rule in the repo's own linter, a pre-commit hook, or a CI job, whichever the repo's language and existing guardrail make cheapest. Default to building the check over writing the rule. Reserve `CODING_STANDARDS.md` for genuine **judgement calls** (cross-file consistency, "matches the surrounding style", anything no guardrail can substitute for) — `orc-pr-reviewer` reads it as the Standards axis. _Trigger:_ the reviewer failed to catch a mistake, or a mechanical rule lives in prose.
- **Steering files** — are there instructions in `CLAUDE.md` / `AGENTS.md` (repo or global) that belong in coding standards or in an automated check instead? _Trigger:_ the steering file is large.
- **Tool economy** — did the agent make expensive tool calls that could be streamlined? Which subagent cost the most (`usage.jsonl`), and did a re-dispatch repeat work a context pointer would have carried? Is any custom tooling (a CLI, an MCP server) token-inefficient? _Trigger:_ an expensive tool call or a costliest-agent outlier.
- **No-ops** — instructions in steering files that don't change the agent's behaviour versus its default. Apply the test from `orc:writing-for-agents`: delete the whole sentence, never trim it. _Trigger:_ the steering files are large and unwieldy.
- **Information access** — what did the agent need and could not see? Dev-server logs it could have tailed, read-only access to a third-party service, a browser for the surface it changed, a staging database. _Trigger:_ a crucial piece of information was not available to the agent.
- **Gates and escalations** (orc-specific) — which escalations fired and why (`slices.json` `escalated`, ambiguous slices, new-dependency stops), which gates were answered without reading (a candidate for `interaction_policy: guided`), which plan annotations were wrong (`touchpoints` overlap, `dependsOn` missing). _Trigger:_ an escalation, a repeated red, or a gate the user waved through every time.

For every candidate record: **what happened** (the evidence, file:line or session excerpt), **the proposed change**, **where it lives** (a check, a standard, a pointer, a doc, a tool), and **severity** (how much of the session it cost, or would cost again).

### Phase 3 — Present

Rank by severity, worst first. Print one table (`#`, category, severity, one-line finding, where it lives), then each candidate's evidence and proposed change in a short block. Write the same content to `${ORC_STATE_DIR}/<branch>/files/retro.md` so `/orc:resume` and a later retro can see what was already proposed.

Then one gate (soft-inward, `orc:gates` §4 — `multiSelect`, default none): **which candidates to act on now?** Group the options as *apply in this repo* (a pointer, a lint rule, a CI job, a standards entry) and *file for later* (anything bigger than one commit).

### Phase 4 — Act

- **Apply** — make the in-repo changes on the current feature branch (iron rule 1 still holds: never on a protected branch), one commit per candidate via `orc:git-commit`. A new check must be seen failing on the mistake it targets and passing after — the retro does not ship an unverified guardrail (`orc:verification-before-completion`).
- **File** — for the rest, run the `orc:tracker-config` read protocol, print `**📋 Preview — tracker writes**` with every issue body verbatim, then `AskUserQuestion` — hard-outward, never skipped by `--auto`. Each issue carries the evidence, the proposed change, and the `needs-triage` label; no AI attribution anywhere in it.

Close with `**➡️ Next**`: what the next session starts with that this one did not.

## Reference

### Implementation vs review

All work goes through two stages. The implementation agent has the most **context pressure**: exploration, writing code, debugging failures. The review agent has the least — it receives a diff, so no exploration, and rarely writes code. So the **review** agent is the right place to impose coding standards, not the implementer: a standard added to `CODING_STANDARDS.md` costs the implementer nothing and the reviewer one read.

### Where things live

- `CLAUDE.md` / `AGENTS.md` — pushed into the context of every agent in the repo. Use sparingly, usually only for **navigation pointers** to other files.
- `CODING_STANDARDS.md` — read during review, not implementation (`orc-pr-reviewer`, Standards axis). Point to docs folders once it passes ~1,000 lines.
- Docs — reference files, pointed to by other files. Look for an existing doc before writing one.
- Skills — docs whose description earns a slot in the agent's context, or user-invoked commands. Write them per `orc:writing-for-agents`; house rules in `orc:skill-writing`.
- Checks — the repo's linter config, pre-commit hooks, CI workflows. The cheapest durable fix for anything mechanical.

## Iron rules

- **Environment, not code.** A retro never reopens the PR's code review; a code finding goes back to `/orc:address` or `/orc:debug`.
- **Mechanical → check, judgement → standard.** Never write a prose rule for something a linter can enforce.
- **Primary sources only.** Read the session artifacts and logs; never retro from memory of the session.
- **No tracker write without the preview gate.** Hard-outward, at every autopilot level.

## Output

- `${ORC_STATE_DIR}/<branch>/files/retro.md` — the ranked candidates and what was done with each
- In-repo commits for applied candidates (pointers, checks, standards)
- Tracker issues for filed candidates, each behind its preview
- No new `.orc/` session — the retro reads an existing one and annotates it
