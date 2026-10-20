---
name: writing-plans
description: Write a comprehensive implementation plan of bite-sized TDD tasks that an engineer with zero codebase context could execute — exact files, code, tests, and verification steps. Use when you have a spec or requirements for a multi-step task, before touching code.
license: MIT
metadata:
  author: Jesse Vincent
  source: Derived from https://github.com/obra/superpowers
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** Run this in a dedicated worktree (created by the brainstorming skill).

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Scope Check

If the spec covers multiple independent subsystems, brainstorming splits it into sub-project specs. If it didn't, suggest separate plans — one per subsystem. Each plan produces working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in. In an existing codebase, follow `orc:code-discovery` to locate the relevant files cheaply — when a Graphify code graph is available, `graphify query`/`path` surfaces which modules a change touches and how they connect, so you map the file list without reading the whole tree; fall back to Glob/Grep otherwise.

- Design units with clear boundaries and well-defined interfaces. Each file has one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task produces self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## LOC Budget Heuristic

Each task produces a diff small enough to review in one sitting. Target **≤ 300 LOC per task** (additions + deletions, post-exclusion — lockfiles, generated code, snapshots, and migrations don't count). Defer to `orc:pr-size-budget` for the exclusion list and resolution order (env var, per-repo config, default).

Add an `est_loc: <int>` field to every task header. Read [LOC-BUDGET.md](references/LOC-BUDGET.md) for the estimate heuristic, the Graphify blast-radius refinement, the **1.5× budget** signal (split further, or mark `ships_as_stack: true`), and the budget-contract rule the implementer escalates on.

## Per-slice concurrency + acceptance annotations (mandatory)

Every slice header also carries — same vocabulary `orc-jira-architect` emits for Jira tasks, so one contract covers both surfaces:

```markdown
### Slice 3 — POST /export endpoint
- repo: api                # workspace mode only
- est_loc: 140
- touchpoints: src/routes/export.ts, test/export.test.ts
- parallel_group: 2
- depends_on: [1]
- acceptance:
  - POST /export returns 202 + a Location header
  - row-stream test covers a 10k-row report
```

Field semantics (`touchpoints` evidence rule, the `parallel_group` disjointness test, `depends_on`, testable `acceptance`): [TEMPLATE.md](references/TEMPLATE.md), "Slice header fields".

On plan approval, the dispatching command copies these annotations into the `slices.json` ledger (`orc-state slice init`; shape per `orc:state-protocol`) — consumers read the ledger, not the prose.

## Plan Document Header and Task Structure

Every plan starts with the mandatory header and lays out each task as numbered checkbox steps (failing test → run → implement → run → commit) with exact paths and code. Read [TEMPLATE.md](references/TEMPLATE.md) before writing the plan file.

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Execution Handoff

After saving the plan, offer the execution choice (subagent-driven or inline). Read [HANDOFF.md](references/HANDOFF.md) for the prompt text and the required sub-skill per choice.
