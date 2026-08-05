---
name: release-management
description: "Cut a semver release from conventional commits — compute the bump from commits since the last tag, generate a grouped changelog with PR links, create an annotated tag and GitHub release. Use when releasing, tagging a version, bumping semver, or writing release notes."
---

# Release management

## Overview

A release is a mechanical consequence of the commit history, not a judgment call. Conventional commits since the last tag determine the bump; the same commits, grouped, become the changelog; an annotated tag plus a GitHub release publishes it. This skill defines the doctrine — `/orc:release` is the interactive command built on it.

**Announce at start:** "I'm using the release-management skill because this task cuts or prepares a release."

## Hard rule — clean tree, green suite

**Never release from a dirty tree or a red suite.** Before anything else:

```bash
git status --porcelain          # MUST be empty
<project test command>          # MUST pass — run it, read the output
```

If either fails, stop. Do not stash, do not `--no-verify`, do not "tag now, fix later". A tag is a permanent public claim that this exact tree was releasable. There is no override flag for this rule.

## Finding the last tag

```bash
git describe --tags --abbrev=0                       # nearest tag on this branch
git tag --list --sort=-v:refname | head -5           # sanity-check against the full list
```

No tags at all → this is the first release: the commit range is the whole history, and the version is chosen (typically `v0.1.0`), not computed.

## Semver decisioning

Collect commits since the last tag:

```bash
git log <last-tag>..HEAD --pretty='%H%x09%s%x09%b' --no-merges
```

Classify each subject against Conventional Commits, then take the **highest** bump any commit demands:

| Signal | Bump |
|---|---|
| `BREAKING CHANGE:` in body/footer, or `!` after type/scope (`feat!:`, `fix(api)!:`) | **major** |
| `feat:` / `feat(scope):` | **minor** |
| `fix:`, `perf:` | **patch** |
| `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `chore:`, `style:`, `revert:` | none on their own |

- Only none-bump commits since the last tag → surface it: there is nothing release-worthy. Releasing anyway (e.g. docs-only) is a deliberate user choice, defaulting to patch.
- Non-conventional subjects don't silently vanish: list them under an "Uncategorized" bucket and treat them as patch-level unless the diff clearly says otherwise.

### Pre-1.0 convention

Before `v1.0.0` the public contract is explicitly unstable, and the common convention shifts everything down one notch: **breaking changes bump minor** (`0.4.2` → `0.5.0`) and **features/fixes bump patch**. Detect which convention the repo already follows from its tag history; when ambiguous, ask — never guess a `1.0.0` into existence. Crossing `0.x` → `1.0.0` is always a human decision, never computed.

## Changelog generation

Group the classified commits — **breaking first, then features, then fixes**; everything else is optional noise unless user-visible:

```markdown
## v1.4.0 — 2026-08-05

### Breaking
- Remove deprecated `/v1/export` endpoint (#87)

### Features
- Add CSV export to reports (#91)
- Team-scoped API tokens (#88)

### Fixes
- Pagination cursor off-by-one on empty pages (#93)
```

Resolve PR links by searching merged PRs for each commit SHA:

```bash
gh pr list --state merged --search "<sha>" --json number,title,url --limit 1
```

(Squash-merge repos can shortcut: subjects usually already carry `(#N)` — verify rather than re-search.) Write entries as user-facing outcomes, not commit subjects verbatim: "Team-scoped API tokens" beats "feat(auth): add team_id to token claims".

If the repo keeps a `CHANGELOG.md`, prepend the new section under the top heading, matching the file's existing style (Keep a Changelog, plain sections, whatever it uses). Don't create the file uninvited — that's a repo-convention decision for the user.

## Tag + GitHub release

Always an **annotated** tag (lightweight tags carry no message, no tagger, no date — release tooling and `git describe` treat them as second-class):

```bash
git tag -a "v1.4.0" -m "v1.4.0"
git push origin "v1.4.0"
gh release create "v1.4.0" --title "v1.4.0" --notes-file <notes-file>
```

The release notes are the changelog section for this version. `gh release create --generate-notes` is the fallback when no curated notes exist — curated notes from the grouped changelog are strictly better. Echo the release URL that `gh release create` prints.

## Monorepo note — tag prefixes

Monorepos releasing packages independently use **prefixed tags** per package: `api-v1.4.0`, `cli-v0.9.2`, `@scope/pkg@1.2.0` (npm/changesets style). In that case every step above scopes to the prefix:

```bash
git describe --tags --abbrev=0 --match "api-v*"
git log api-v1.3.0..HEAD --no-merges -- packages/api/
```

— last tag matched by prefix, commit range filtered to the package's path, changelog and release named with the prefix. Detect the convention from existing tags before inventing one; mixing prefixed and bare `v*` tags in one repo is how release workflows misfire (orc's own repo is the cautionary example: plain `v*` triggers the CLI goreleaser workflow, plugin tags need the `orc--` prefix).

## Iron rules

1. Never release from a dirty tree or red suite — no exceptions, no flags.
2. The bump is computed from commits, then confirmed by a human — never applied silently.
3. Annotated tags only; never move or delete a pushed tag.
4. Never create `CHANGELOG.md` in a repo that doesn't have one without explicit consent.
5. `1.0.0` is declared by a human, never computed.
