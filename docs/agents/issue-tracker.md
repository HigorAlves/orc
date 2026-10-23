# Issue tracker: GitHub

Issues for this repo live as GitHub Issues in `HigorAlves/orc`. Use the `gh` CLI for all operations (reference: `orc:gh-cli`). Every new issue arrives as `needs-triage` (the issue forms add it; `.github/workflows/triage-label.yml` catches the rest) and is judged against `SCOPE.md`.

## Conventions

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies)
- **Read**: `gh issue view <n> --comments`
- **List**: `gh issue list --state open --json number,title,labels` with `--label` filters
- **Comment**: `gh issue comment <n> --body "..."`
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <n> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** External PRs are reviewed with `/orc:code-review`, not triaged; a PR that is really a feature request gets an issue.

## When a skill says "publish to the issue tracker"

Create a GitHub issue. When a skill says "fetch the relevant ticket": `gh issue view <n> --comments`.

## Factory (optional)

Not configured here. To enable "Send to the factory" in `/orc:triage`, uncomment:

```
# machineUrl: http://127.0.0.1:4317
```

## Wayfinding operations

Used by `/orc:wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map` holding the Destination / Notes / Decisions-so-far / fog body.
- **Child ticket**: a sub-issue of the map (`gh api` on the sub-issues endpoint). Type label: `wayfinder:research|prototype|grilling|task`. No triage labels on wayfinder tickets.
- **Blocking**: GitHub's native issue dependencies — `gh api --method POST repos/HigorAlves/orc/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` (database id via `gh api repos/HigorAlves/orc/issues/<n> --jq .id`). Unblocked = every blocker closed.
- **Frontier**: open children with no open blocker and no assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n>` with the answer, `gh issue close <n>`, then append a gist + link to the map's Decisions-so-far.
