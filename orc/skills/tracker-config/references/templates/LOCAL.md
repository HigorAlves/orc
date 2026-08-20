# Seed template — issue-tracker.md (local markdown)

### issue-tracker.md — Local markdown

````markdown
# Issue tracker: Local markdown

Issues for this repo live as committed markdown files under `docs/issues/`.

## Conventions

- One effort per directory: `docs/issues/<slug>/`
- The spec (when there is one) is `docs/issues/<slug>/spec.md`
- One file per issue: `docs/issues/<slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined file
- Triage state is a `Status:` line near the top of each issue file (role strings from `docs/agents/triage-labels.md`); category is a `Category:` line (`bug` / `enhancement`)
- Conversation history appends under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `docs/issues/<slug>/` (creating directories as needed). When a skill says "fetch the relevant ticket": read the referenced file.

## Wayfinding operations

Used by `/orc:wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `docs/issues/<effort>/map.md` — the Destination / Notes / Decisions-so-far / fog body.
- **Child ticket**: `docs/issues/<effort>/issues/NN-<slug>.md` with a `Type:` line (`research`/`prototype`/`grilling`/`task`) and a `Status:` line (`open`/`claimed`/`resolved`).
- **Blocking**: a `Blocked by: NN, NN` line near the top. Unblocked = every listed file is `resolved`.
- **Frontier**: scan for files that are `open`, unblocked, and unclaimed; lowest number wins.
- **Claim**: set `Status: claimed` before any work.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, then append a gist + link to the map's Decisions-so-far.
````
