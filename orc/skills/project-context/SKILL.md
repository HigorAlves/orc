---
name: project-context
description: The durable agent-directive layer — project-context.md, the lean set of conventions every executor agent loads before touching code. Use when generating, refreshing, reading, or appending a rule to a repo's project context; /orc:context is the surface, this skill is the contract.
---

# Project Context

`.orc/` is per-branch and ephemeral by design. **This layer is not.** `project-context.md` is the one artifact that carries a repo's implementation conventions across branches, sessions, and agents — so `orc-implementer` on branch #40 doesn't re-derive what branch #1 already settled.

## What it is — and is not

| It is | It is not |
|---|---|
| **Directives to agents** — "use X, never Y, here" | Documentation for humans |
| Project-specific conventions a model would otherwise guess wrong | Universal practice the model already knows |
| Rules that survive the branch | A scratchpad, a plan, or session state |
| ~150 lines, read on every implementation task | An architecture doc (that's `docs/adr/` + `/orc:onboard`) |

The test for every line: **would a competent engineer new to this repo get this wrong without being told?** If no, cut it. "Write tests" is noise. "Tests live beside the source as `*.test.ts`, never in a `__tests__/` dir" is the artifact.

## Where it lives

Resolution is owned by `orc:tracker-config` (single reader — nothing else re-implements it) and recorded in `docs/agents/domain.md` under `## Project context`:

| Repo opted in at `/orc:setup` | Path | Committed |
|---|---|---|
| yes | `docs/agents/project-context.md` | yes — shared with the team |
| no (default) | `.orc/project-context.md` | no — gitignored, personal |

**`.orc/project-context.md` is the one `.orc/` file that is per-repo, not per-branch.** It sits beside `orc.json`, never inside `<branch>/files/`, and `/orc:cleanup` never removes it.

When neither exists, consumers proceed silently. An absent context layer is the default state of a repo, not an error — never gate on it, never nag.

## The section spine

Six sections, in this order. Omit any section that would be empty — an empty heading is a token tax.

```markdown
---
generated: 2026-08-27
generator: /orc:context generate
stack_fingerprint: <sha of the dependency manifest set>
---

# Project context

<!-- Agent directives. Read before writing code in this repo. -->

## Stack & versions
## Critical rules
## Patterns to follow
## Patterns to avoid
## Testing conventions
## Known landmines
```

- **Stack & versions** — language/runtime/framework majors that change idiom (React 19 vs 18, Go 1.25, PG 16). Versions only where the version changes the answer.
- **Critical rules** — the non-negotiables. Violating one breaks the build, the deploy, or a contract.
- **Patterns to follow** — the repo's chosen idiom where more than one is reasonable, with a one-line pointer to a canonical example.
- **Patterns to avoid** — what was tried and rejected. Each line earns its place by having actually happened.
- **Testing conventions** — runner, file placement, naming, fixture strategy, what "green" means.
- **Known landmines** — the surprising ones. Generated files that must not be hand-edited, a module with load-bearing import order, a test that fails only in CI.

Full worked example and the per-line rubric: [references/FORMAT.md](references/FORMAT.md).

## The size cap — and why it is load-bearing

**150 lines / 6 KB, hard.** This file is preloaded into `orc-implementer`, `orc-test-author`, `orc-code-fixer`, and `orc-qa-validator` — it is paid for on **every** implementation task in the repo, forever. A 600-line context file is a permanent tax on every slice.

`scripts/ci/verify-project-context.sh` enforces the cap in this repo. Consumers enforce it socially: when generating or appending, if the file would exceed the cap, **cut before you add**. The retro loop (`orc:retrospective`) is the main source of growth, so it is also where pruning belongs — a rule that no longer fires is a rule to delete.

## Generation

`/orc:context generate` follows `orc:code-discovery` — graphify first, Glob/Grep fallback. Derive, don't invent:

1. **Stack** — dependency manifests, lockfile majors, `engines`/`toolchain` pins, CI workflow runtimes.
2. **Conventions** — sample the real tree, not the README. Test file placement, import style, error-handling shape, directory idiom. State what the code *does*, not what a linter config claims.
3. **Rules** — CI gate scripts, `Makefile` targets, pre-commit hooks, `CONTRIBUTING.md`. A CI gate is a critical rule by definition.
4. **Landmines** — generated-file headers, `.gitattributes` `linguist-generated`, files whose git history is exclusively tool commits.

Draft, then **gate before writing** — the file directs every future agent, so a wrong line compounds. Present the draft with its line count against the cap.

## Refresh

`/orc:context refresh` is diff-aware and **never clobbers human edits**:

- Lines with a `<!-- human -->` marker, or any line under a `## Notes` section, are preserved verbatim.
- Regenerated sections are diffed against the existing file; the diff is what gets gated, not the whole file.
- A changed `stack_fingerprint` is the signal a refresh is due. Surface it when a consumer notices drift — never auto-refresh mid-task.

## Consumer protocol

Executor agents preloading this skill:

1. Resolve the path via `orc:tracker-config`. Absent → proceed silently.
2. Read it **once**, at dispatch, before any discovery.
3. Treat **Critical rules** as binding. A slice that requires violating one is an **escalation**, not a judgment call.
4. Treat the other sections as strong defaults — deviating is allowed, but say so in the slice report.
5. Never write to it directly. Rules are appended via `/orc:context add-rule`, which is what `orc:retrospective` calls.
