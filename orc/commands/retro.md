---
description: Retrospective on a coding session — proposes changes to the agent's environment (navigation pointers, automated checks, coding standards, steering files, tool economy, information access), most severe first; applies accepted in-repo changes and files the rest through the tracker gate
when_to_use: Use after a build or a debug session, especially one that went sideways.
argument-hint: "[--session <branch>] [--transcript <path>] [--propose] [<what to look back on>]"
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
  - Bash(bash:*)
---

# /orc:retro

Look back at a coding session and improve the **environment** the next session runs in, not the code it produced.

A retro's output is a navigation pointer, a lint rule, a CI job, a coding standard, a slimmer steering file, a log the agent could not see. The code review already judged the code; this judges what made the code hard to get right.

Where it sits: the last step of the main flow (`/orc:flow` Phase 9 and `/orc:debug` offer it), and a standalone command after any session that went sideways.

## Arguments

- `--session <branch>` — look back at that `.orc/<branch>/` session instead of the current one.
- `--transcript <path>` — a session log on disk, read as a primary source once `/clear` has emptied the conversation.
- `--propose` — run P1 then P5: calibration and candidate project-context rules.
- `<what to look back on>` — free text narrowing the retro: "the three red slices", "why QA took 40 minutes".

## Preconditions

> **🛑 Tracker writes**
>
> P4 files issues on the tracker. The preview gate before it is hard-outward: `--auto` never skips it.

> **⚠️ Caution**
>
> P4 commits applied candidates on the current feature branch, never on a protected branch.

- A `.orc/<branch>/` session is optional. Without one, say so and work from the conversation and git log alone.

## Phases

Modules live in `orc:phases` (`references/retro/`). Entering a phase, Read exactly its module.

| Phase | Module | Skipped when |
|---|---|---|
| 0 Detect context | resident, below | never |
| 1 Primary sources | `orc:retro/P1` | never |
| 2 Candidates | `orc:retro/P2` | never |
| 3 Present | `orc:retro/P3` | never |
| 4 Act | `orc:retro/P4` | the P3 gate selects no candidate |
| 5 Propose | `orc:retro/P5` | no `--propose` |

With `--propose`, run P1, then P5, and stop; P2 to P4 do not run.

### Phase 0 — Detect context

1. Resolve the session branch: `--session <branch>`, else `git branch --show-current`.
2. If `${ORC_STATE_DIR}/<branch>/` is missing, note it for P1.
3. Record `--transcript <path>` and the free-text focus, when given.
4. Invoke `orc:writing-for-agents`.

NOTE: invoke `orc:writing-for-agents` on every run, not only before writing. It defines what a no-op instruction is and what a good steering file looks like; P2 judges steering files against it before any write.

## Iron rules

- Environment, not code. A code finding goes back to `/orc:address` or `/orc:debug`; never reopen the review.
- Mechanical → check, judgement → standard. Never write a prose rule for something a linter can enforce.
- Primary sources only. Read the session artifacts and logs; never retro from memory of the session.
- No tracker write without the preview gate. Hard-outward, at every autopilot level.
- A new check must fail on the mistake it targets and pass after the fix.

## Output

- `${ORC_STATE_DIR}/<branch>/files/retro.md` — the ranked candidates and the action taken on each.
- In-repo commits for applied candidates: pointers, checks, standards.
- Tracker issues for filed candidates, each behind its preview.
- With `--propose`: `files/planning-calibration.json`, `files/proposed-rules.md`, `files/retro/incidents.json`. `docs/agents/project-context.md` changes only after the gate, uncommitted.
- No new `.orc/` session. The retro reads an existing one and annotates it.
