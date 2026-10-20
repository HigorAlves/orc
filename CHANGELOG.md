# Changelog

All notable changes to the orc plugin. Versions are the `orc--vX.Y.Z` plugin tags; the CLI releases separately under plain `vX.Y.Z` tags. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); each entry links the PR that landed it. The `plugin-release` workflow publishes a version's section as its GitHub Release notes when the tag is pushed.

## [0.27.0] - 2026-10-20

The precision train: every orc file is written to a controlled-language standard adapted from ASD-STE100 and S1000D (issue #115), the largest surfaces are split into phase modules, and the Claude Code plugin practices orc was missing (routing fields, fail-closed hooks, a measured eval suite) are in.

### Added
- Authoring standard (`orc/skills/skill-writing/references/AUTHORING-STANDARD.md`, ADR 0007): glossary as restricted vocabulary, a fixed unapproved-word list, 15-word verb-first procedural steps, notices before the step they guard, a fixed task anatomy for commands, size caps, phase modules with a code. `scripts/ci/verify-ste.sh` enforces it as a ratchet (`--report`, `--where`, `--update`); `verify-context-cost.sh` ratchets the always-on description total.
- `orc:phases` (generalised from `flow-phases`): per-command phase modules under `references/<command>/PHASE-<N>-<NAME>.md`, headed by `<!-- orc:<command>/P<N> -->`, loaded one at a time.
- `when_to_use` frontmatter on 60 skills and commands, with `description` reduced to what the surface does; agent descriptions capped near 250 characters. Always-on description total 30,435 → 27,419 characters.
- Guard hooks fail closed: the `pre-git-guard` dispatcher now asks (never allows) when `jq` is missing, a check script is missing, crashes, or returns unreadable output; `verify-guard-hooks.sh` covers both. `onFailure: "block"` on every PreToolUse guard additionally lets the harness block when the dispatcher itself cannot run, on Claude Code versions that honour the key (hooks.md); older clients ignore it, and the in-script behaviour holds either way.
- Eval suite 7 → 21 cases: a routing case per command family, two negatives, and a fail-fast regression on the rewritten `code-review`.
- ADR 0008 (commands stay flat files; `code-review`, `cleanup`, `incident` piloted as skill directories with modules beside them) and a skill-doctor step in contributing.md.
- `orc:agent-browser` gains `references/QA-RECIPES.md` and `references/STEPS-TEMPLATE.md`, disclosed from the QA validator.

### Changed
- Ten commands rewritten under the standard, each entry at most 6 KB with phases as modules: `code-review` (17 KB → 4 KB), `cleanup`, `incident`, `triage`, `qa`, `plan`, `stack-pr`, `wayfinder`, `retro`, `ship`. Behaviour, gates, templates and iron rules unchanged.
- `orc-qa-validator` (14.6 KB → 5.8 KB) and `orc-implementer` (13 KB → 6.8 KB) rewritten under the standard.
- Sixteen skills over 6 KB gained a `references/` directory (progressive disclosure, no behaviour change).
- 75 hedged sentences across skills and agents reworded (should → must or a condition; might → can).

## [0.26.0] - 2026-10-20

The mattpocock/skills alignment train: the vendored skills resynced at upstream `5beb35b`, a retro loop after every build, and the maintainer discipline the upstream repo runs on.

### Added
- `/orc:retro` — retrospective on a session that proposes environment changes (navigation pointers, automated checks, coding standards, steering-file pruning, tool economy, information access, gates and escalations), most severe first; applies in-repo changes on the branch and files the rest behind the tracker gate. Offered from `/orc:flow` Phase 9 and at the end of `/orc:debug` (#118).
- Smell baseline for review: `orc:review-contract` carries a fixed Fowler smell set (`references/SMELLS.md`) as judgement-call `suggestion` findings; `/orc:code-review` now reads `CODING_STANDARDS.md` and `CONTRIBUTING.md` beside `CLAUDE.md`, and standards findings are counted separately from spec findings, never reranked (#118).
- Merge danger in PR bodies: `orc:caveman-pr` requires a `Door: one-way | two-way · Blast radius:` line for anything beyond a trivial fix, states evidence tiers, and allows one small visual when the shape is the point; `/orc:ship --verbose` adopts the Summary / Why / Evidence / Merge danger shape (#118).
- `/orc:setup` creates the triage labels the tracker lacks, behind the hard-outward Tracker gate (#118).
- Repo governance for orc itself: `SCOPE.md`, `docs/agents/out-of-scope.md`, issue forms with `needs-triage` on open and a 14-day `needs-info` close, `docs/adr/` for orc's own decisions, a root `GLOSSARY.md`, this changelog, and a `plugin-release` workflow that publishes the GitHub Release from the tag (#118).

### Changed
- Upstream sync at `5beb35b`: grilling separates questions with a rule and words each so "yes" accepts the recommendation; `orc:tdd` notes what each proposed seam catches and misses; `orc:systematic-debugging` redacts secrets first and proves a forced red landed; `orc:to-issues` attaches slices as sub-issues; `/orc:wayfinder` keeps triage labels off map tickets and never PRs a research branch; `/orc:start` and `/orc:flow` state a Jira ticket's title before acting; `orc:map` reads a file before asserting what it does (#118).
- `CONTEXT.md` / `CONTEXT-MAP.md` renamed to `GLOSSARY.md` / `GLOSSARY-MAP.md` everywhere orc reads or writes the glossary; legacy names are still read (#118).
- `orc:wizard` re-vendored: the template gains Readline prompts, dotenv quoting, symlink and EOF handling, and drops the time estimate (#118).

## [0.25.0] - 2026-10-07

### Added
- Playwright-first browser QA against named targets in `.orc/targets.json` (local Docker env or a probed remote such as staging), credentials as references (`op://`, `env:`), guarded targets, login once via `storageState`, a committed `e2e/` scaffold with the stock planner/generator/healer agents, and one stitched `qa-<branch>.webm` with per-criterion overlays and `chapters.json` (#112).
- `/orc:explain` — a narrated walkthrough of a QA packet: demo clips, animate motion-graphic segments, local kokoro-js voice, assembled by `orc-explain`; new `explainer_style` and `explainer_voice` settings (#112).
- Evidence delivery can post a verdict table as one PR comment behind the Post gate; new CLIs `orc-targets`, `orc-playwright`, `orc-qa-video`, `orc-explain`; new skills `qa-targets`, `playwright-qa`, `explainer` (#112).

## [0.24.0] - 2026-10-06

### Changed
- The `/orc` cockpit becomes a reactive dashboard with real controls: header strip, phase ladder beside the slice ledger, collapsible QA · PR · Agents · Decisions · Digest · Diff sections, selects for autopilot and model profile, links to PRs (#109).

## [0.23.0] - 2026-10-05

### Added
- The orc mod (Claude Code 2.1.287+): in-process hooks layered over the bash guards — attribution rewritten at the source, compaction keeps orc's place, the `/orc` cockpit pane, model profiles (`balanced` / `quality` / `economy`), a per-subagent usage ledger, gate badges, and a background CI watcher with optional chime (#103, #104, #105).
- `orc-report`: QA evidence as a self-contained HTML report, optionally published as a private Artifact (#102).
- Plugin eval suite (`orc/evals/`) with guardrail and state cases, run nightly (#100, #101).
- Preview gates everywhere a write leaves the machine, destructive-git blast-radius prompts, PreCompact auto-checkpoint, `orc:gates` (#98, #99).

### Changed
- Escalation-aware dispatch: a slice that cannot go green re-dispatches one model step up (Opus, then Fable where available); Claude 5 lint on agent frontmatter (#100, #98).

## [0.22.0] - 2026-08-20

### Added
- Criterion-anchored QA evidence on both browser drivers: one screenshot per acceptance criterion and a scored `qa-manifest.json` that `/orc:qa` reads to build the verdict (#93).

### Changed
- Docs restructured: slim README, `docs/` pages, examples under `docs/examples/`, roadmap dropped (#92).

## [0.21.0] - 2026-08-20

### Added
- Statusline: a plugin-shipped two-line renderer (session, phase, slices, branch, PR state; model, context bar, cost, rate limit), the `orc statusline` CLI verb, `orc-state line` as the shared live-session selector, and a context-monitor bridge hook so the agent learns its own context pressure (#86, #87, #88, #89).

## [0.20.0] - 2026-08-20

### Changed
- Caveman by default: commit bodies, PR bodies, review comments, and reply drafts are terse and signal-only, using the GitHub renderer (suggestion blocks, `<details>`, auto-links) to carry more with fewer words; `--verbose` opts out (#82, #83).

## [0.19.0] - 2026-08-20

### Added
- `interaction_policy` autopilot ladder (`manual` / `guided` / `auto`) and `--auto` on eight commands; outward gates never skip (#76, #79).
- `orc:tracker-config` read protocol and the settled-decisions store (`decisions.json`, write-once per key with provenance) (#74).
- Shared `orc:browser-qa` and `orc:ci-routing` skills; sprint contract; `/orc:flow` decomposed into per-phase playbooks loaded on demand (#79).

## [0.18.0] - 2026-08-20

### Added
- `orc-state` CLI and the `orc:state-protocol` skill — the single writer for `.orc/` session state, with 53 CI cases (#60, #61).
- Slice ledger (`slices.json`) with concurrency and acceptance annotations; resume startup sequence with a digest-bounded restore; persisted gate inputs and `qa-verdict.json` (#67, #68, #71).

### Changed
- Thin-index refactors: `jira-cli`, `postgresql-table-design`, `shadcn` move reference bulk behind `references/` (#63, #64, #65).
- Commands migrated from state prose to `orc-state`; legacy vocabulary banned (#62).

## [0.17.0] - 2026-08-20

### Changed
- Harness economy: one guard prompt per git command via the `pre-git-guard` dispatcher; rubber-stamp gates deleted from `/orc:flow` (13 → 9 turns); triage and ship gates bundled into single questions; interaction loops in `/orc:ci`, `/orc:code-review`, `/orc:address` batched; implementer preload trimmed from 32 KB to 17 KB; source-aware SessionStart payload; always-resident description catalog slimmed (#50–#57).

## [0.16.1] - 2026-08-12

### Fixed
- Manifest-only bump so marketplace installs pick up 0.16.0.

## [0.16.0] - 2026-08-05

### Added
- The SDLC mega-train: skills unioned with mattpocock/skills at `2ffb184`, a full rename pass, per-agent model and reasoning-effort matrix, agents rebuilt, and the post-PR lifecycle — `/orc:ci`, `/orc:release`, `/orc:deps`, `/orc:incident`, `/orc:setup` (#45).
- Jira Epic → Story → Task hierarchy: the `orc:jira-hierarchy` contract, `orc-jira-architect`, and `/orc:jira-breakdown` (#47).
- Example walkthroughs refreshed to cover the new surfaces (#46).
