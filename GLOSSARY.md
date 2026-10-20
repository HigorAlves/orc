# orc

A full-SDLC Claude Code plugin: skills, commands, agents, and hooks that drive the senior-developer loop (plan → implement → QA → ship → CI → release) with discipline the hooks enforce. These are the words orc's own files think with; use them exactly.

## Language

**Iron rule**:
One of the eight non-negotiables `orc:using-orc` injects at session start (no commits to protected branches, no code without a failing test, no claim without verification, no fix without root cause, no AI attribution, no multi-phase work without state, no silent broadcast, no PR over budget without a recorded choice). Hooks enforce the ones a hook can reach.
_Avoid_: guideline, best practice, rule of thumb

**Gate**:
A pause where a command asks before continuing. Three classes: **hard-outward** (a write that leaves the machine: tracker, PR review, evidence publish; always asks), **soft-inward** (a decision about the user's own tree; the autopilot ladder can pre-approve it), **escalation-only** (never asked proactively; always stops the run when triggered).
_Avoid_: prompt, confirmation, checkpoint (that word is state, below)

**Autopilot ladder**:
The `interaction_policy` setting, or `--auto[=guided|full]` per run, that decides how soft-inward gates behave: `manual` asks at every gate, `guided` auto-advances mechanical confirms, `auto`/`full` runs phases against a **sprint contract** agreed at kickoff. Outward gates never move.
_Avoid_: autonomy level, YOLO mode

**Sprint contract**:
The criteria `/orc:flow` and the user agree before an `auto` run: what done means per phase, so autonomous phases have something to be measured against.

**Session**:
One registered run of a multi-phase command, keyed by the sanitized branch name, living in `.orc/<branch>/files/` and listed in `.orc/orc.json`. Resumable via `/orc:resume`.
_Avoid_: workspace (that is the multi-repo mode), run

**Checkpoint**:
The per-session `checkpoint.md`: frontmatter mirror plus a bounded **resume digest** whose `Next:` line names the one artifact a resumed session reads first. Written only through `orc-state`.

**Slice**:
One tracer-bullet unit of a plan, sized for a single fresh context window, driven red → green → committed by `orc-implementer`. Slices carry `dependsOn`, `parallelGroup`, and `touchpoints` (the files they own).
_Avoid_: task, step, ticket (tickets live on the tracker)

**Ledger**:
`slices.json`: the slice status machine (`pending`, `red`, `green`, `committed`, `escalated`) the orchestrator and `/orc:resume` read instead of trusting a claim.

**Frontier**:
Everything that can be worked on now because its prerequisites are settled: the open, unblocked tickets on a wayfinder map; the questions a grilling round can ask; the slices whose `dependsOn` are all committed.

**Escalation**:
An implementer or investigator stopping with a named condition (can't go green after three attempts, ambiguous slice, new dependency, out-of-scope file) and two or three options for the user. Re-entered with `SendMessage`, never re-dispatched blind.

**Evidence packet**:
The artifacts in `.orc/<branch>/files/qa/` that back a "QA passed" claim: per-criterion screenshots, the stitched video, `qa-manifest.json`, console, HAR, narrated steps. No packet, no claim.

**QA target**:
A named place browser QA runs against (`.orc/targets.json`): `local` boots the Docker env, a remote is probed. Credentials are references (`op://`, `env:`), never values.

**Driver**:
The browser automation behind `orc:browser-qa`: Playwright (primary), the agent-browser CLI, or Claude-in-Chrome.

**Investigator / Executor**:
The two agent roles. An investigator reads and reports (reviewer, debug investigator, CI investigator, architects); an executor changes the tree (implementer, code-fixer, test-author, env-provisioner, QA validator). Investigators carry no Write or Edit.

**Size budget**:
The soft 300 LOC per-PR limit (additions plus deletions after exclusions). Over budget means stack, abort, or open big with a `Size-budget-override:` trailer that records the reason.

**Train**:
A release-sized batch of related changes landing as independent PRs, with the version bumped in the last one. A **mega-train** lands as one PR under a size-budget override.

**Caveman**:
The default writing register for commit bodies, PR bodies, review comments, and replies: terse, signal-only, no throat-clearing, using the GitHub renderer to carry more with fewer words. `--verbose` opts out.

**Callout palette**:
The fixed set of emoji-headed blockquotes (`💡 Insight`, `⚠️ Caution`, `🛑`, `⛔ Gate`, `📋 Preview`, `➡️ Next`); GitHub `[!TYPE]` tags only in GitHub-bound output.

**Mod**:
The in-process Claude Code hooks module (`hooks/mod/`) that adds the `/orc` cockpit, attribution at the source, compaction awareness, model profiles, and the CI watcher. A layer over the bash hooks, never a replacement.

**Cockpit**:
The `/orc` pane the mod draws from `$.state`: phase ladder, slice ledger, QA · PR · Agents · Decisions · Digest · Diff sections, with real controls.

**Workspace mode**:
Running orc from a parent directory of sibling git repos; one flow spans them with per-repo worktrees, a cross-repo contract in the plan, and N linked PRs. Repo-touching commands need an explicit `--repos` or a confirming gate: no silent broadcast.

**Tracker layer**:
`docs/agents/issue-tracker.md`, `triage-labels.md`, and `domain.md`, written once by `/orc:setup` and read by every tracker-aware surface through `orc:tracker-config`.

**Intake**:
`/orc:triage`: the one entry point for an incoming report (tracker item, Sentry issue, pasted text). It runs the validity check before anyone works on the report.
_Avoid_: inbox, report handler

**Validity check**:
Five questions a report must pass before work: real, not a duplicate, not already done, in scope, enough detail. Adds a severity.

**Retro**:
`/orc:retro`: the look back after a session that changes the environment (checks, standards, pointers, access), not the code.

## Unapproved words

The glossary is also the restricted vocabulary (ADR 0007). These words never appear in a command, agent or skill; `verify-ste.sh` fails on them.

| Unapproved | Write instead |
|---|---|
| should | must, or delete the sentence |
| might, may | can, or state the condition |
| leverage, utilize | use |
| ensure | verify, then say how |
| in order to | to |
| prior to | before |
| subsequently | then |
| perhaps | delete; state the condition |

## Relationships

- A **Session** owns one **Checkpoint** and one **Ledger**; the ledger holds **Slices**.
- A **Gate**'s class decides whether the **Autopilot ladder** may pre-approve it; a **Sprint contract** is what `auto` measures against.
- An **Escalation** always stops the run, at every rung of the ladder.
- A "QA passed" claim requires an **Evidence packet** produced by a **Driver** against a **QA target**.
- A **Train** is cut by the **Size budget**; a mega-train records an override.
- The **Mod** draws the **Cockpit**; the bash hooks enforce the **Iron rules** with or without it.
