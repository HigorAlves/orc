# Contributing to orc

orc is curated: what is accepted is in [SCOPE.md](../SCOPE.md), what was already rejected in [agents/out-of-scope.md](agents/out-of-scope.md). Read both before opening an issue. The conventions below keep the plugin consistent; CI enforces most of them.

## The rules that bite contributors

1. No commits to `main`, `master` or `develop`. Branch first; the hook asks otherwise.
2. A new surface ships with a check that proves it fires: an eval case for a routing change, a fixture for a script, a manual smoke run for a skill body.
3. Never claim a surface works without running it. The plugin must load with `claude --plugin-dir ./orc`.
4. Fix the cause, never the symptom.
5. No AI attribution in commits, PRs or skill bodies. The hook refuses it.
6. Every PR is independent and targets `main` ([ADR 0001](adr/0001-independent-prs-over-stacked-chains.md)). A change that cannot be split carries a `Size-budget-override:` trailer.

## How orc's files are written

Every command, agent and skill follows the **authoring standard** in [`orc/skills/skill-writing/references/AUTHORING-STANDARD.md`](../orc/skills/skill-writing/references/AUTHORING-STANDARD.md) ([ADR 0007](adr/0007-controlled-language-authoring-standard.md)). The short version:

| Rule | Means |
|---|---|
| Restricted vocabulary | Use the term in [GLOSSARY.md](../GLOSSARY.md); never a synonym it lists under *Avoid*. |
| No unapproved words | should, might, perhaps, ensure, in order to, prior to, subsequently, leverage as a verb. The lint fails on them. |
| Steps of 15 words, one action, verb first | "Run the suite." A condition can open the step: "If the diff is empty, stop." Paths, flags and reasons go in a `NOTE:` line below. |
| Notices before the step | `🛑` for irreversible or outward actions, `⚠️ Caution` for damage to the tree, `💡 Insight` for a fact the step depends on. |
| Size caps | Command entry 6 KB, agent 8 KB, skill 6 KB without `references/`. |
| Phase modules | A command keeps Phase 0 and the phase index resident; each later phase is a module under `orc/skills/phases/references/<command>/PHASE-<N>-<NAME>.md`, headed by `<!-- orc:<command>/P<N> -->`. |

`scripts/ci/verify-ste.sh` enforces this as a ratchet against `scripts/ci/precision-baseline.json`: unapproved words fail outright; for an existing file the long-step, non-imperative, passive, byte and description counts may only fall; a new file meets every cap. Useful invocations:

```bash
bash scripts/ci/verify-ste.sh --report              # worst files first
bash scripts/ci/verify-ste.sh --where orc/commands/qa.md   # the offending lines in one file
bash scripts/ci/verify-ste.sh --update              # tighten the baseline after a rewrite; commit it
```

## Adding a skill

New surfaces are skill directories, not flat command files ([ADR 0008](adr/0008-commands-as-skills.md)).

1. Create `orc/skills/<kebab-name>/SKILL.md`. The directory name and `name:` match.
2. Write the frontmatter:

   ```yaml
   ---
   name: <kebab-name>
   description: What the skill does, third person, one sentence.
   when_to_use: Use when <trigger>, <trigger>; not for <boundary>.
   ---
   ```

   `description` says what; `when_to_use` carries the triggers and the boundary. Both load into every session, so together they stay under 200 characters. Quote a value that contains `: `.
3. Write the body under the standard: steps first, the reference every branch needs next, the rest disclosed into `references/<TOPIC>.md` and linked from SKILL.md with a one-line pointer saying when to read it.
4. For a user-facing surface (what used to be a command), add `argument-hint`, `allowed-tools` (least privilege, verb-level: `Bash(gh pr view:*)`), and keep the task anatomy: title, Arguments, Preconditions, Phases with Phase 0 resident, Iron rules, Output. Keep it model-invocable unless no routing case ever needs it; `disable-model-invocation: true` hides it from the model, and orc's routing evals reach surfaces through the model.
5. If it is a user-facing surface, add it to `orc/skills/map/SKILL.md` (the router) and to the table in [commands.md](commands.md).
6. Vendored or derived from elsewhere? Add the provenance frontmatter from `orc:skill-writing` and the licence to [THIRD-PARTY-LICENSES.md](../THIRD-PARTY-LICENSES.md).
7. Add a routing eval case under `orc/evals/route-<name>/` (prompt plus a `tool_used: Skill` grader).
8. Reload with `/reload-plugins` and run it once.

## Adding a command (legacy flat file)

Only for a change to an existing command under `orc/commands/`. The frontmatter is the same as a skill's minus `name:`; the body follows the task anatomy; phases past Phase 0 live in `orc:phases`. Every command appears in `orc:map` (CI checks this).

## Adding a subagent

1. Create `orc/agents/orc-<role>.md`. The `orc-` prefix is required.
2. Frontmatter:

   ```yaml
   ---
   name: orc-<role>
   description: <Role> role — what it does and who dispatches it. Under 260 characters.
   tools: Read, Glob, Grep, Bash(git log:*)        # allowlist, least privilege
   disallowedTools: Write, Edit, NotebookEdit      # investigators never write
   model: opus | sonnet | haiku
   effort: low | medium | high
   color: red | blue | green | purple | orange | cyan
   maxTurns: 15-80
   skills:                                         # preload the doctrine it runs under
     - orc:tdd
   ---
   ```

3. The body stays under 8 KB: role, inputs, workflow steps, what it does not do, output contract, iron rules, tone. Reference material lives in a skill the agent preloads, under that skill's `references/`.
4. A command dispatches it via `Task`; a user never invokes it directly.

## Adding a hook

1. Add `orc/hooks/scripts/<event>-<purpose>.sh`, executable.
2. Wire it in `orc/hooks/hooks.json` with an `"if"` permission-rule filter so it spawns only for the commands it guards, and `"onFailure": "block"` for any PreToolUse guard, so a missing or slow script blocks instead of allowing.
3. Use `${CLAUDE_PLUGIN_ROOT}` for every path.
4. Read tool input as JSON on stdin; exit 0; put decisions on stdout as JSON (`hookSpecificOutput.permissionDecision` for PreToolUse, `additionalContext` or `systemMessage` for SessionStart). Let `jq -n --arg …` own the encoding.
5. Add cases to `scripts/ci/verify-guard-hooks.sh` for a guard, or `verify-hooks.sh` for wiring.

## Before you push

```bash
for s in scripts/ci/verify-*.sh scripts/ci/shellcheck.sh; do bash "$s" || break; done
claude plugin validate ./orc --strict
```

What they check: references resolve (`verify-refs`), counts match across README, marketplace and architecture (`verify-counts`), frontmatter conventions, hook wiring and fail-closed guards, the guard regexes (55 cases), the authoring standard and the always-on cost ratchets, the changelog, install pins, the statusline and QA fixtures. Then add a line under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md) for any behaviour change.

### Behavioural evals

`orc/evals/` holds `claude plugin eval` cases, one directory each: `prompt.md` (frontmatter: limits, `allowed_tools`) plus `graders/*.md`. Graders stay deterministic (`tool_used`, `regex`, `tool_order`, `file_exists`) so the nightly workflow stays cheap. Each run is a real model call on your account:

```bash
claude plugin eval ./orc --case route-debug --runs 1 --ablation none           # one case
claude plugin eval ./orc --case 'route-*' --runs 1 --ablation none -j 4        # all routing cases
claude plugin eval ./orc --ablation none --runs 2 --threshold 0.8 \
  --scaffold --allow-tools Bash Write Edit --trust-plugin                      # the suite, as CI runs it
```

Guardrail and state cases build a git fixture via `scaffold.sh` and need the Bash grant. A routing case that drops to 0 after a description change means the surface stopped triggering on natural phrasing: fix `when_to_use`, not the grader. Ablation stays `none` in CI because under with-without the `Skill` graders become indicators rather than scores.

### Context cost and skill-doctor

Every `description` and `when_to_use` loads into every session. `bash scripts/ci/verify-context-cost.sh --print` prints the total; CI ratchets it. Once per release, run `/skill-doctor` in an interactive session and paste its report into the release PR: it lists each skill's token cost and seven-day usage and flags skills never invoked. A skill flagged twice in a row is a candidate for the out-of-scope KB or for merging into the skill that does fire. `claude plugin details orc` prints the harness's own projection for the installed plugin.

## Commit hygiene

- Conventional Commits (`feat(skills): …`, `fix(hooks): …`); the `orc:git-commit` skill writes them.
- One logical change per commit. No body unless the why is not obvious.
- Never `--amend` after pushing. Never force-push a shared branch.

## When you change something

A rename or a description change touches more than one file. CI catches the drift, so run the scripts above; the usual set is `orc:map`, [commands.md](commands.md), the counts in README, `marketplace.json` and [architecture.md](architecture.md), and any `orc:<name>` mention in commands, agents and skills.

## Releasing

Claude Code keys its plugin-update cache on the `version` in `orc/.claude-plugin/plugin.json`: commits without a manifest bump are invisible to installs, and installs pinning `ref` never move. Plugin releases use `orc--vX.Y.Z` tags; the CLI uses plain `vX.Y.Z` ([ADR 0003](adr/0003-dual-tag-releases.md)).

1. In the last PR of a train, bump `version` in `plugin.json` and rename `## [Unreleased]` in `CHANGELOG.md` to the version and date. `verify-changelog.sh` fails without that section.
2. After the merge, tag and push:

   ```bash
   v="orc--v$(jq -r .version orc/.claude-plugin/plugin.json)"
   git tag -a "$v" -m "orc ${v#orc--v}" && git push origin "$v"
   ```

3. The `plugin-release` workflow checks the tag against `plugin.json`, extracts the version's changelog section and publishes the GitHub Release. If it is red, fix the mismatch and re-push the tag; never hand-create the release.
4. Move the pinned `ref` in README and [install.md](install.md) to the new tag in a follow-up PR (`verify-version.sh` checks the tag exists).

No version bump, no release. A merged PR that skips the bump ships only to `--plugin-dir` development.
