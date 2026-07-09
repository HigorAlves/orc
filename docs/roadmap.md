# orc — improvement roadmap

Deferred improvements mapped against current Claude Code capabilities (researched 2026-07-02 against ~v2.1.198; re-verified 2026-07-09 against current docs). The quick wins shipped in the 0.6.0 train.

**Status (2026-07-09): the full roadmap was executed across the 0.7.0 / 0.8.0 / 0.9.0 trains** — Tier B entirely (B1–B8), C1a (worktree hooks; C1b evaluated and rejected, see below), C2 (differentiation + skill-creator deletion), C3 (investigator memory), C4 (userConfig), C5 (antigravity deleted). The 0.8.0 train additionally shipped the env-provisioning capability (`/orc:env`, `orc-env-provisioner`, `orc:env-provisioning`, `lib/docker-env.sh`) — Docker dev environments for QA, which was not on this roadmap. Item text below is kept for the record; each heading carries its verdict.

Effort: S (< half day) · M (half–2 days) · L (multi-day).

## Tier B — high-value medium efforts — ALL SHIPPED (0.7.0)

### B1. Dynamic context injection replaces the dot-source hack — SHIPPED (0.7.0)
Skill/command bodies support `` !`command` `` preprocessing; `${CLAUDE_PLUGIN_ROOT}` substitutes inline. Today the 13 workspace-aware commands (`flow`, `ship`, `plan`, `status`, `qa`, `resume`, `cleanup`, `address`, `code-review`, `debug`, `fan-out`, `stack-pr`, `start`) carry `Bash(. */lib/workspace-detect.sh*)` allowed-tools wildcards and burn a model round-trip sourcing `lib/workspace-detect.sh` at runtime — and the lib's memoization (`ORC_CONTEXT_CACHED`) never works because every Bash call is a fresh subshell. Add a `--banner` CLI mode to the lib and inject `` Workspace: !`"${CLAUDE_PLUGIN_ROOT}"/lib/workspace-detect.sh --banner` `` at the top of those command files; delete the dot-source patterns from `allowed-tools`. `/orc:status` can inject the whole `.orc/orc.json` registry the same way.

### B2. `bin/` executables on PATH + one Bash-permission dialect — SHIPPED (0.7.0)
Files in a plugin's `bin/` are invokable as bare commands while the plugin is enabled. Wrap the libs as `orc/bin/orc-workspace-detect` and `orc/bin/orc-pr-size`; allowed-tools become a uniform, auditable `Bash(orc-workspace-detect *)` / `Bash(orc-pr-size *)`. While touching every file, normalize the two mixed matcher dialects (`Bash(git *)` vs `Bash(npm *:*)`) to one. Pairs naturally with B1 — do them together.

### B3. Preload skills into agents via `skills:` frontmatter — SHIPPED (0.7.0)
Agent frontmatter `skills: [...]` injects full skill content at subagent startup (supported for plugin agents). Today executors re-discover orc skills mid-run or never load them. Candidates: `orc-implementer` → `[orc:tdd, orc:git-commit, orc:verification-before-completion]`; `orc-test-author` → `[orc:tdd, orc:vitest]`; `orc-qa-validator` → `[orc:agent-browser]`; `orc-debug-investigator` → `[orc:systematic-debugging]`; `orc-code-fixer` → `[orc:receiving-code-review]`. Full bodies are injected — cap at 1–3 per agent and watch token cost.

### B4. Persist workspace detection via `$CLAUDE_ENV_FILE` — SHIPPED (0.7.0)
SessionStart hooks can append `export VAR=...` to `$CLAUDE_ENV_FILE`; the vars persist into every subsequent Bash call. Have `session-start-using-orc.sh` write `ORC_CONTEXT`, `ORC_REPO_ROOT`, `ORC_WORKSPACE_ROOT`; `lib/workspace-detect.sh` short-circuits when set. The memoization finally works — session-wide.

### B5. Command frontmatter modernization — SHIPPED (0.7.0)
- `disable-model-invocation: true` on side-effecting, user-timed commands: `cleanup`, `jira`, `stack-pr`, `scaffold` (each also drops its description from the always-on catalog). Verify `/orc:flow` never dispatches them via the Skill tool first.
- `model: haiku` on `status.md` (read-only table rendering); `effort: high` on `plan.md`/`rfc.md`.
- `context: fork` + `agent: Explore` on `status.md` so registry reads never pollute the main context.
- Named `arguments:` where `argument-hint` exists (`jira`, `debug`, `plan`).

### B6. `sessionTitle` from the active orc session — SHIPPED (0.7.0)
SessionStart hooks can set `hookSpecificOutput.sessionTitle`. When `session-start-using-orc.sh` finds an in-progress `.orc/orc.json` session for the current branch, emit `sessionTitle: "orc: <command> <branch> [phase]"` — resume-heavy workflows become findable in session lists for free.

### B7. CI: `claude plugin validate --strict` + drift checks — SHIPPED (0.7.0)
`.github/` has zero workflows; count drift (54/19/10 vs 57/20/11) is exactly the bug class `contributing.md` warns about. Add `.github/workflows/validate.yml`: (1) `claude plugin validate ./orc --strict`; (2) `bash -n` all `orc/hooks/scripts/*.sh` + `orc/lib/*.sh`; (3) `jq empty` all JSON; (4) callout lint (`grep -rn '\[!' orc --include='*.md' | grep -vE '\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|TYPE)\]'` → empty); (5) count check vs README/marketplace.json. Do this first among the B items — it locks in everything the 0.6.0 train shipped.

### B8. Release tagging discipline — SHIPPED (0.7.0)
plugin.json says 0.6.0 but git tags stop at v0.5.0, and installs pin `ref`. Because explicit `version` keys the update cache, commits without a manifest bump are invisible to installs. Adopt `claude plugin tag --push` per release (create `v0.6.0` when the current train merges — the README already pins it); document the bump-or-no-update rule in `contributing.md`.

## Tier C — bigger bets — SHIPPED (0.9.0), verdicts below

### C1. Native worktree integration — SHIPPED (hooks) / REJECTED (agent isolation)
**C1a shipped (0.9.0 train):** `worktree-create.sh`/`worktree-remove.sh` pin every harness-managed worktree (`--worktree`, `isolation: worktree`) under `<repo>/.orc/.worktrees/<sanitized-branch>` — the "never $HOME" rule is harness-enforced.

**C1b evaluated and rejected:** `isolation: worktree` on `orc-implementer` is architecturally incompatible with flow's choreography. Flow Phase 4 creates the *feature-branch* worktree and passes its path; an isolation-worktree agent gets its *own* harness worktree branched from the default branch, and on Claude Code ≥ 2.1.203 confinement makes `cd` into flow's worktree fail — slice commits would land on an auto-branch instead of the feature branch. On < 2.1.203 the flag adds nothing (confinement bug). Revisit only if the harness ever supports `isolation: worktree` with an explicit branch/base override per dispatch.

### C2. Redundancy audit vs bundled capabilities — SHIPPED (0.9.0): differentiated descriptions + skill-creator deleted
Claude Code now bundles `/code-review` (with `--comment`/`--fix`/ultra), `/debug`, `/verify`, `/run`, `/security-review`, and an official skill-creator plugin. Overlaps to adjudicate: `orc:code-review`+`orc-pr-reviewer`+`inline-review` vs bundled `/code-review --comment`; `orc:debug`+`systematic-debugging` vs `/debug`; `orc:qa` vs `/verify`+`/run` (orc's browser-evidence contract is genuinely differentiated — keep, but sharpen the description); `orc:skill-creator` vs the official plugin (candidate deletion); `orc-security-reviewer` vs `/security-review`. Each kept skill's `description:` should say when to prefer it over the bundled one — the model sees both catalogs. Payoff: catalog token cut across 57 skills + less trigger ambiguity.

### C3. Agent `memory:` for cross-session learning — SHIPPED (0.9.0): orc-debug-investigator only
Agent frontmatter `memory: user|project|local` gives agents a persistent directory across sessions. Start with one agent — `orc-debug-investigator` with `memory: project` (recurring failure modes per repo) — and evaluate staleness before rolling out to `orc-stack-analyzer` / `orc-pr-reviewer`.

### C4. `userConfig` tunables — SHIPPED (0.9.0)
plugin.json `userConfig` prompts at enable time; values substitute as `${user_config.KEY}` in hook commands and export as `CLAUDE_PLUGIN_OPTION_<KEY>`. Declare `pr_size_budget` (number, default 300), `protected_branches` (string), `skip_tool_check` (boolean); consume in `lib/pr-size-budget.sh` and the hook scripts. Turns orc from personal plugin into configurable-for-others.

### C5. Antigravity mirror: fix or archive — RESOLVED: antigravity deleted (a2e7e73)
The mirror is broken beyond cosmetics: `antigravity/hooks.json` invokes nonexistent `gemini-skills/` paths, `hooks/session-start.sh` resolves `orc-core` at the wrong path (`antigravity/orc-core/` instead of `antigravity/skills/orc-core/`, so it injects a literal error string), versions drift (README says 0.4.0, plugin.json says 0.4.3, vs orc's 0.6.0), roughly 90 shared files differ from `orc/` (measured 89 on the 0.6.0 train — the gap widens with every unmirrored change), and `dist/` has no generator. Either (a) write `scripts/sync-antigravity.sh` + CI byte-compare and fix the two broken hook paths, or (b) move `antigravity/` to its own repo/branch and delete it here. Given zero shared tooling exists, (b) is cheaper and honest. Decide early — it de-risks every future change.

## Evaluated and deliberately skipped

- `type: prompt` / `type: agent` hooks for the commit guards — latency + cost per Bash call outweighs closing the `&&`-chaining bypass. If hardening is wanted, parse the first non-env token and handle `git -C` in the existing scripts instead.
- `once: true` hooks — only honored in skill frontmatter, not plugin hooks.json; can't replace the startup-only matcher.
- Monitors, channels, LSP servers, themes, MCP servers — no orc use case; orc is CLI-tool-driven by design.
- Agent teams — still experimental behind an env flag; `/orc:fan-out` covers the stable subset via parallel subagents.
- `defaultEnabled: false` — wrong for a personal always-on plugin.
