---
name: gh-cli
description: "GitHub CLI (gh) reference for repos, issues, PRs, Actions, releases, gists, projects, codespaces, and the API. Use for any gh command or GitHub operation from the terminal."
---

# GitHub CLI (gh)

Index for working with GitHub from the command line via `gh`. This file is a thin guide — the bulk of the command flags/examples live in `references/<topic>.md`. **Read the relevant `references/` file when you need detail for that topic.**

**Version:** 2.85.0 (current as of January 2026)

## When to use

Reach for `gh` whenever the task is a GitHub operation from the terminal: opening/viewing/merging PRs, filing or triaging issues, inspecting CI runs, cutting releases, managing repos/labels/secrets, or hitting the REST/GraphQL API. Prefer dedicated `gh <noun> <verb>` commands over raw `gh api` when one exists.

## Decision tree

- Working with a PR? → see common workflows below, then `references/pr.md`.
- Filing/triaging an issue? → common workflows below, then `references/issue.md`.
- Logging in, tokens, scopes, config, SSH/GPG keys? → `references/auth.md`.
- Creating/cloning/forking/editing repos, labels, rulesets, orgs, browse? → `references/repo.md`.
- CI: runs, workflows, caches, secrets, variables? → `references/actions.md`.
- Posting a structured PR review with inline comments + suggestions? → `references/pr.md` (the `gh api .../reviews` section) and the `orc:inline-review` skill.

## Common orc workflows (inline)

### PR: create / view / diff / checkout

```bash
# Create a PR (interactive, or with title/body/base/draft)
gh pr create --title "Feature: X" --body "..." --base main
gh pr create --draft
gh pr create --body-file .github/PULL_REQUEST_TEMPLATE.md

# View a PR (add --comments / --web; --json for fields)
gh pr view 123
gh pr view 123 --json title,body,state,author,commits,files

# Diff a PR
gh pr diff 123
gh pr diff 123 --name-only
gh pr diff 123 > pr-123.patch

# Check out a PR branch locally
gh pr checkout 123

# Checks, merge, ready
gh pr checks 123 --watch
gh pr merge 123 --squash --delete-branch
gh pr ready 123
```

→ Full flags, edit/comment/review/lock/revert/status, and the inline-review API: `references/pr.md`.

### Issue ops

```bash
# Create / list / view
gh issue create --title "Bug: ..." --body "..." --labels bug
gh issue list --state open --assignee @me --labels bug
gh issue view 123 --comments

# Edit / comment / close / reopen
gh issue edit 123 --add-label high-priority --add-assignee user1
gh issue comment 123 --body "Fixed in #456"
gh issue close 123 --comment "Done"
gh issue reopen 123

# Spin a branch/draft-PR off an issue
gh issue develop 123 --branch feature/issue-123
```

→ Full flags, status/pin/lock/transfer/delete, and bulk operations: `references/issue.md`.

## Topic index

Read the matching file on demand for full flags and examples.

| Topic | File | Covers |
|-------|------|--------|
| Auth & config | `references/auth.md` | Install, `gh auth` (login/status/switch/token/refresh/setup-git), `gh config`, env vars, SSH/GPG keys, git integration |
| Repositories | `references/repo.md` | `gh repo` (create/clone/list/view/edit/delete/fork/sync/set-default/autolink/deploy-key/gitignore/license), `gh browse`, `gh label`, `gh ruleset`, `gh org`, repo-setup & fork-sync workflows |
| Issues | `references/issue.md` | `gh issue` (create/list/view/edit/close/comment/status/pin/lock/transfer/delete/develop), create-PR-from-issue, bulk ops |
| Pull requests | `references/pr.md` | `gh pr` (create/list/view/checkout/diff/merge/close/reopen/edit/ready/checks/comment/review/update-branch/lock/revert/status) + inline-review REST API (`POST .../reviews`, suggestion blocks) |
| GitHub Actions | `references/actions.md` | `gh run`, `gh workflow`, `gh cache`, `gh secret`, `gh variable`, CI/CD workflow |
| Releases | `references/release.md` | `gh release` (create/list/view/upload/download/edit/delete/verify), `gh attestation` |
| Gists | `references/gist.md` | `gh gist` (list/view/create/edit/delete/rename/clone) |
| Projects | `references/project.md` | `gh project` (list/view/create/edit/delete/copy/fields/items/link) |
| Codespaces | `references/codespace.md` | `gh codespace` (list/create/view/ssh/code/stop/delete/logs/ports/rebuild/edit/jupyter/cp) |
| API, search & extensions | `references/api-and-extensions.md` | `gh api` (REST + GraphQL), `gh search`, `gh extension`, `gh alias`, `gh status`, `gh completion`, `gh preview`, `gh agent-task`, global flags, JSON/template output, best practices, full CLI command tree, external docs |

## Quick global reference

- `--repo OWNER/REPO` targets another repo; `--json FIELDS --jq EXPR` for machine output; `--web` opens in browser; `--paginate` for large result sets.
- Set a default repo once: `gh repo set-default owner/repo`.
- For automation, export a token: `export GH_TOKEN=$(gh auth token)`.
- See `references/api-and-extensions.md` for the full global-flags table and the complete `gh` command tree.
