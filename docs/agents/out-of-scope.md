# Out of scope

Rejected enhancements, one section per concept, so a decision is made once and surfaced the next time it comes up (`/orc:triage` reads this file in step 1). Durable reasons only: "not now" is a deferral, not a rejection, and does not belong here. Seeded from the 2026-10-20 mattpocock/skills alignment plan.

## Shrinking the catalog to a small composable set

orc will not be reduced to a handful of composable skills that leave the process to the user.

**Why out of scope:** owning the whole SDLC is orc's thesis. The hooks, `.orc/` state, QA evidence rule, gates, evals, and cockpit exist because a process the model can talk itself out of is not a process. A small composable set is a different product with a different thesis, and mattpocock/skills already is that product. orc takes the pruning habit (no-op hunting, progressive disclosure, `/orc:retro`), not the size target.

**Prior requests:** none filed; recorded from the alignment plan.

## Multi-harness metadata (Codex, Copilot, Gemini)

orc will not carry `agents/openai.yaml` beside each skill or an install path for harnesses other than Claude Code.

**Why out of scope:** orc's guardrails are PreToolUse hooks, its cockpit is a Claude Code mod, and its installer is the `orc` CLI. The skills alone would run elsewhere, but the plugin would not, and shipping half of it under another harness's name describes a product that does not exist. The upstream skills orc vendors remain installable on their own from mattpocock/skills.

**Prior requests:** none filed.

## Plain-text questions instead of `AskUserQuestion` gates

orc will not route grilling or its gates through plain chat text to stay harness-neutral.

**Why out of scope:** the gate taxonomy (hard-outward, soft-inward, escalation-only), the autopilot ladder, header chips, previews, and multiSelect chunking are all built on `AskUserQuestion`. Upstream rejects the native question tool on principle because its skills must run everywhere; orc runs in one harness and spends that constraint on better gates.

**Prior requests:** none filed.

## Removing em-dashes from skill prose

orc will not run a repo-wide em-dash purge or ban the character in `SKILL.md`, command, and agent files.

**Why out of scope:** the house style uses the em-dash as the inline separator precisely because it dodges the YAML colon-space trap in single-line descriptions, and descriptions that must contain `: ` are quoted. Upstream's purge was a readability preference with no behavioural change behind it; applying it here is churn across 84 skills with nothing to measure. Recorded as ADR 0005. User-facing terminal output and PR bodies follow their own writing rules.

**Prior requests:** none filed.

## Changesets for versioning

orc will not adopt `@changesets/cli` for the plugin changelog and version bumps.

**Why out of scope:** changesets need a root `package.json` and a Node toolchain in a repo whose plugin is Markdown and bash and whose CLI is Go. orc already enforces Conventional Commits, so the changelog is written by hand per PR under `## [Unreleased]`, the release PR names the version, `verify-changelog.sh` keeps it honest, and `plugin-release.yml` publishes it. Same outcome, no new toolchain.

**Prior requests:** none filed.

## Dropping Jira as a first-class tracker

orc will not reduce its tracker support to GitHub, GitLab, and local markdown.

**Why out of scope:** Jira is a first-class tracker here on purpose: the `orc:jira-hierarchy` contract, `orc-jira-architect`, `/orc:jira-breakdown`, `/orc:jira`, and the evidence-publish adapter all exist for shops that run on it. Upstream declines Jira because its maintainer does not run it; this repo's maintainer does.

**Prior requests:** none filed.
