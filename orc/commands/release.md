---
description: "Cut a semver release for the current repo — bump computed from conventional commits, evidence preview, tag + GitHub release. Use when releasing a version, tagging, or publishing release notes."
argument-hint: "[--dry-run] [--tag-only]"
allowed-tools:
  - Bash(orc-state:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git tag:*)
  - Bash(git describe:*)
  - Bash(git push origin:*)
  - Bash(git branch --show-current:*)
  - Bash(gh pr list:*)
  - Bash(gh release create:*)
  - Bash(gh release view:*)
  - Bash(jq:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(go:*)
  - Bash(cargo:*)
  - Bash(pytest:*)
  - Bash(orc-workspace-detect:*)
---

# /orc:release

Cut a release from the commit history: verify the tree is releasable, compute the semver bump from conventional commits since the last tag, show the evidence, gate, then tag + `gh release create`. Doctrine lives in `orc:release-management` — invoke it (announce it) before Phase 2.

## Not for orc itself

**Do not run this command in orc's own repository.** orc releases via the dual-tag process documented in `docs/contributing.md`: plugin releases use `orc--v*` tags (manifest bump in `orc/.claude-plugin/plugin.json`, tag in the last PR of a release train), and CLI releases use plain `v*` tags that trigger the goreleaser workflow (`.github/workflows/release-cli.yml`) — with a guard job that rejects cross-namespace tags. A generic single-tag release here would either misfire the CLI workflow or ship a plugin nobody can install. If the current repo is orc, stop and point the user at `docs/contributing.md`.

## Arguments

- `--dry-run` — stop after the preview: compute the bump, render the evidence, write nothing, tag nothing.
- `--tag-only` — skip the changelog and GitHub release; just create + push the annotated tag.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection). This command is single-repo: in workspace mode, ask which repo to release via `AskUserQuestion` and operate inside it. If the repo is orc itself (remote or directory name matches), stop per "Not for orc itself".

### Phase 1 — Preflight: clean tree + green suite

Hard rule from `orc:release-management` — never release from a dirty tree or red suite.

1. `git status --porcelain` — must be empty. Untracked files count as dirty.
2. Detect and run the project's test command (`package.json` scripts, `Makefile`, `go test ./...`, `cargo test`, `pytest` — whatever the repo actually uses). Read the output; per `orc:verification-before-completion`, no green claim without evidence.
3. Confirm the current branch is the release branch (normally the default branch). Releasing from a feature branch is almost always a mistake — surface and confirm before continuing.

On any failure, print the danger callout and stop:

```markdown
> **🛑 Cannot release**
>
> <dirty tree: N modified/untracked files | test suite failed: summary>. Fix, commit, and re-run — there is no override.
```

4. Register state: `orc-state init --command release --total-phases 5`. Defer to `orc:state-protocol` for schema and rules; checkpoint each phase (`orc-state phase set <n>` + `orc-state digest write -`) so `/orc:resume` can continue an interrupted run.

### Phase 2 — Compute the bump

Invoke `orc:release-management` (announce it). Following it:

1. Find the last tag (`git describe --tags --abbrev=0`; monorepo prefix-aware if the tag history says so). No tags → first release: propose an initial version instead of computing one.
2. `git log <last-tag>..HEAD --no-merges` — classify every commit: breaking (`!` / `BREAKING CHANGE:`) → major, `feat` → minor, `fix`/`perf` → patch, rest → none; highest wins. Apply the pre-1.0 convention when the repo is pre-1.0.
3. Resolve PR links per commit (`gh pr list --state merged --search "<sha>" --json number,url --limit 1`, or the `(#N)` suffix on squash-merge repos).

Save the classified list to `${ORC_STATE_DIR}/<branch>/files/release-evidence.md`.

### Phase 3 — Preview + gate

Render the preview with the evidence — the commit list grouped by type is what makes the bump auditable:

```markdown
> **📋 Release preview**
>
> `<last-tag>` → `<next-version>` (**<major|minor|patch>**) — <N> commits since <last-tag>.
```

```
Breaking:
  <sha7> <subject> (#PR)
Features:
  <sha7> <subject> (#PR)
Fixes:
  <sha7> <subject> (#PR)
Other (no bump):
  <sha7> <subject>
```

If `--dry-run`: stop here, mark the session `status: done` with `dry_run: true` in the checkpoint.

Print the gate headline (`**⛔ Gate — release**`, per `orc:callouts`), then `AskUserQuestion`:

- "Release `<next-version>` — proceed"
- "Override the bump — pick major / minor / patch myself" (re-render the preview with the chosen version, then re-gate)
- "Abort"

### Phase 4 — Changelog

Skip this phase entirely when `--tag-only`.

- Repo **has** a changelog file (`CHANGELOG.md` or equivalent): prepend the new version section — grouped breaking/features/fixes with PR links, matching the file's existing style — and commit it (`chore(release): <next-version>`, per `orc:git-commit`).
- Repo has **no** changelog file: do not create one silently. `AskUserQuestion`: "Create CHANGELOG.md?" — *Create it* / *Skip — release notes only*. Only create on explicit consent.

Either way, write the notes for this version to `${ORC_STATE_DIR}/<branch>/files/release-notes.md` — Phase 5 uses it.

### Phase 5 — Tag + publish

1. Annotated tag, then push:

   ```bash
   git tag -a "<next-version>" -m "<next-version>"
   git push origin "<next-version>"
   ```

   (Plus the changelog commit push if Phase 4 committed one.)

2. Unless `--tag-only`:

   ```bash
   gh release create "<next-version>" --title "<next-version>" \
     --notes-file "${ORC_STATE_DIR}/<branch>/files/release-notes.md"
   ```

   Fall back to `--generate-notes` only if the notes file is missing.

3. Update the checkpoint to `status: done` with the version and URLs, then echo:

```markdown
> **➡️ Released**
>
> Tag: `<next-version>` · Release: <gh release URL> · Compare: <repo>/compare/<last-tag>...<next-version>
```

## Iron rules

- Never release from a dirty tree or red suite — no override flag exists.
- The computed bump is always confirmed (or overridden) by the user at the Phase 3 gate — never applied silently.
- Annotated tags only; never move or delete a pushed tag.
- Never create `CHANGELOG.md` without explicit consent.
- Never run in orc's own repo — see "Not for orc itself".

## Output

- `${ORC_STATE_DIR}/<branch>/files/release-evidence.md` — classified commit list
- `${ORC_STATE_DIR}/<branch>/files/release-notes.md` — the published notes
- Annotated tag pushed; GitHub release URL echoed (unless `--dry-run` / `--tag-only`)
- Session entry in `.orc/orc.json` set to done

## Resume

If interrupted between phases, `/orc:resume` reads the checkpoint and continues from the next pending phase — Phase 1 preflight re-runs regardless (the tree may have changed since).
