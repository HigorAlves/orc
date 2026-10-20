# 0003 — Dual-tag releases: `orc--v*` for the plugin, `v*` for the CLI

- **Status:** Accepted
- **Date:** 2026-08-05
- **Deciders:** maintainer

## Context

One repository ships two artifacts with different release mechanics. The plugin (`orc/`) is Markdown, bash, and a TypeScript mod; Claude Code keys its update cache on the `version` in `orc/.claude-plugin/plugin.json`, and a commit without a manifest bump is invisible to installed users. The CLI (`cli/`) is Go, published by goreleaser with a Homebrew cask, triggered by a tag push.

goreleaser's workflow watches plain `v*` tags. Tagging a plugin release `v0.16.0` would have run goreleaser against a tree with no CLI change and published a Homebrew cask for it.

## Decision

Plugin releases are tagged `orc--vX.Y.Z` and CLI releases plain `vX.Y.Z`. The CLI workflow's `guard` job rejects a plain `v*` tag whose version equals `plugin.json`'s, since that is almost certainly a mis-tagged plugin release. The plugin version is bumped in the last PR of a release train, the tag follows the merge, and the `plugin-release` workflow publishes the GitHub Release from `CHANGELOG.md`.

## Alternatives considered

### Option A — Two repositories
- Each artifact with its own tag namespace and workflow.
- Rejected: the CLI embeds the plugin's tool registry (`orc/lib/tools.json` mirrored into `cli/internal/deps/tools.json`, checked by CI); splitting them makes the mirror a cross-repo contract.

### Option B — One tag, both artifacts
- Every tag releases both.
- Rejected: most trains touch only the plugin; publishing a CLI with no change burns Homebrew users' update time and makes the CLI changelog noise.

## Consequences

- **Positive:** `git tag -l 'orc--v*'` is the plugin's history and `v*` the CLI's; neither workflow can fire on the other's tag.
- **Negative:** `/orc:release` refuses to run in this repo, because its single-tag model does not fit; releases here follow `docs/contributing.md` by hand plus the tag-triggered workflow.
- **Neutral:** the README install pin trails the tag by one PR by design (`verify-version.sh` checks the pin resolves, not that it is latest).

## Follow-ups

- [x] `plugin-release.yml` publishes the release from the changelog section (0.26.0).
- [ ] Teach `/orc:release` a tag-prefix mode so this repo can use it; until then the refusal stands.
