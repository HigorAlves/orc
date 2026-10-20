<!-- orc:retro/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Candidates

1. For each category below, test its trigger against the P1 sources.
2. If the trigger did not fire, skip the category.
3. For each fired category, hunt for candidates with its question.
4. For every candidate, record the four fields below.

NOTE: an empty retro is a valid retro.

Candidate record:

- **What happened** — the evidence: file:line or a session excerpt.
- **The proposed change**.
- **Where it lives** — a check, a standard, a pointer, a doc, a tool (Where things live, below).
- **Severity** — how much of the session it cost, or would cost again.

## Categories

**Navigation.** How hard was it to find the right files? Hidden dependencies between files? Would a **navigation pointer** (one line in `CLAUDE.md` / `AGENTS.md` naming a doc) have saved the search?
Trigger: the session spent a long stretch locating one piece of information, or a Graphify graph was absent where `orc:code-discovery` would have paid off.

**Automated checks.** Is there a check that would have caught a mistake the agent made? Linting, typing, tests, filesystem linters. A repo with **no guardrail at all** (no pre-commit hook and no CI job running its lint/typecheck/test command) is itself a finding: an un-linted repo is a standing missed opportunity, not a neutral default.
Trigger: a mistake a deterministic check could have caught, or no guardrail exists.

**Coding standards.** Does the reviewer need a new rule, or an existing one removed or clarified? **Classify the violation first.** A **mechanical** violation (a fixed syntactic pattern, a banned API, an import shape, a file-location rule) gets a deterministic check, full stop: a rule in the repo's own linter, a pre-commit hook, or a CI job, whichever the repo's language and existing guardrail make cheapest. Default to building the check over writing the rule. Reserve `CODING_STANDARDS.md` for genuine **judgement calls** (cross-file consistency, "matches the surrounding style", anything no guardrail can substitute for); `orc-pr-reviewer` reads it as the Standards axis.
Trigger: the reviewer failed to catch a mistake, or a mechanical rule lives in prose.

**Steering files.** Are there instructions in `CLAUDE.md` / `AGENTS.md` (repo or global) that belong in coding standards or in an automated check instead?
Trigger: the steering file is large.

**Tool economy.** Did the agent make expensive tool calls that a pointer could streamline? Which subagent cost the most (`usage.jsonl`)? Did a re-dispatch repeat work a context pointer would have carried? Is any custom tooling (a CLI, an MCP server) token-inefficient?
Trigger: an expensive tool call or a costliest-agent outlier.

**No-ops.** Which instructions in steering files do not change the agent's behaviour versus its default? Apply the test from `orc:writing-for-agents`: delete the whole sentence, never trim it.
Trigger: the steering files are large and unwieldy.

**Information access.** What did the agent need and could not see? Dev-server logs it could have tailed, read-only access to a third-party service, a browser for the surface it changed, a staging database.
Trigger: a crucial piece of information was not available to the agent.

**Gates and escalations** (orc-specific). Which escalations fired and why (`slices.json` `escalated`, ambiguous slices, new-dependency stops)? Which gates did the user answer without reading (a candidate for `interaction_policy: guided`)? Which plan annotations were wrong (`touchpoints` overlap, `dependsOn` missing)?
Trigger: an escalation, a repeated red, or a gate the user waved through every time.

## Where things live

Implementation vs review: all work goes through two stages. The implementation agent has the most **context pressure**: exploration, writing code, debugging failures. The review agent has the least: it receives a diff, so no exploration, and rarely writes code. So the **review** agent is the right place to impose coding standards, not the implementer. A standard in `CODING_STANDARDS.md` costs the implementer nothing and the reviewer one read.

- `CLAUDE.md` / `AGENTS.md` — pushed into the context of every agent in the repo. Use sparingly, usually only for **navigation pointers** to other files.
- `CODING_STANDARDS.md` — read during review, not implementation (`orc-pr-reviewer`, Standards axis). Point to docs folders once it passes about 1,000 lines.
- Docs — reference files, pointed to by other files. Look for an existing doc before writing one.
- Skills — docs whose description earns a slot in the agent's context, or user-invoked commands. Write them per `orc:writing-for-agents`; house rules in `orc:skill-writing`.
- Checks — the repo's linter config, pre-commit hooks, CI workflows. The cheapest durable fix for anything mechanical.
