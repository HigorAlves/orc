# Seed template — issue-tracker.md (GitHub Issues)

### issue-tracker.md — GitHub Issues

````markdown
# Issue tracker: GitHub

Issues for this repo live as GitHub Issues in `[owner/repo]`. Use the `gh` CLI for all operations (reference: `orc:gh-cli`).

## Conventions

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies)
- **Read**: `gh issue view <n> --comments`
- **List**: `gh issue list --state open --json number,title,labels` with `--label` filters
- **Comment**: `gh issue comment <n> --body "..."`
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <n> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/orc:triage` reads this flag.)_

When `yes`, external PRs run through the same labels and states via `gh pr view/diff/comment/edit/close`. Discovery keeps only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`. GitHub shares one number space, so resolve a bare `#42` with `gh pr view 42`, falling back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue. When a skill says "fetch the relevant ticket": `gh issue view <n> --comments`.

## Wayfinding operations

Used by `/orc:wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map` holding the Destination / Notes / Decisions-so-far / fog body.
- **Child ticket**: a sub-issue of the map (`gh api` on the sub-issues endpoint; where unavailable, a task-list entry in the map body plus `Part of #<map>` at the top of the child). Type label: `wayfinder:research|prototype|grilling|task`.
- **Blocking**: GitHub's native issue dependencies — `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` (database id via `gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Fallback: a `Blocked by: #<n>` line at the top of the child body. Unblocked = every blocker closed.
- **Frontier**: open children with no open blocker and no assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n>` with the answer, `gh issue close <n>`, then append a gist + link to the map's Decisions-so-far.
````
