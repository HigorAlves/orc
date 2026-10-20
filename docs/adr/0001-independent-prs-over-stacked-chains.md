# 0001 — Independent PRs over stacked chains

- **Status:** Accepted
- **Date:** 2026-08-20
- **Deciders:** maintainer

## Context

Three release trains in August 2026 (0.17.0, 0.18.0, 0.19.0) were opened as chains of stacked PRs, each targeting the one below it. Three times a stacked PR was merged into its stack base before the base had landed on `main` (#52 → re-landed as #57; #69 and #70 → #71; #75, #77, #78 → #79), despite explicit merge-order warnings in the PR bodies and an offer to merge the chain in order. Each time the fix was a re-land PR and a day of untangling.

orc has `/orc:stack-pr` for splitting a branch that blew the size budget, and the size budget itself (`orc:pr-size-budget`, 300 LOC) pushes toward many small PRs. The two forces together made chains the default shape, and chains are what kept breaking.

## Decision

Every PR in this repository is opened against `main` and merges on its own. When a change cannot be made independent, it ships as one PR with a `Size-budget-override:` trailer recording why, not as a chain.

If a chain is ever unavoidable, one actor merges it in order and the stacked PRs say so in their first line; a reviewer never merges a stacked PR.

## Alternatives considered

### Option A — Keep chains, improve the warnings
- Merge-order notes at the top of every PR body, a comment on each PR naming its base.
- Rejected: tried on the third train (#75/#77/#78) and it still failed. The failure is a one-click merge button, not missing information.

### Option B — Adopt stack tooling (gh-stack, spr)
- A tool that rebases and retargets the chain as bases land.
- Rejected: adds a tool to the maintainer's workflow to protect against a mistake made in the GitHub UI, which the tool does not control.

### Option C — Do nothing
- Rejected: three incidents in one month.

## Consequences

- **Positive:** a PR can be merged in any order by anyone; no re-land PRs; `/orc:stack-pr` stays available for the rare case and is no longer the default advice.
- **Negative:** large trains land as one big PR (0.16.0 was 3 PRs; 0.26.0 is one), which reviews worse than five small ones would.
- **Neutral:** the size-budget override trailer appears more often; it is the honest record of the trade.

## Follow-ups

- [x] `harness-economy-train` memory records the rule; this ADR makes it repo-visible.
- [ ] Revisit if GitHub ships native stacked-PR merge ordering.
