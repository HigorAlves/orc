# Linked PRs — schema and body templates

Disclosed from `orc:workspace-mode`. Read at ship time (`/orc:ship`, `/orc:stack-pr`) and when a reader (`/orc:cleanup`, `/orc:address`) iterates `linkedPRs[]`.

## Linked PRs

`/orc:ship` runs in two passes:
1. `gh pr create` per repo, capturing each PR URL into the workspace registry's `linkedPRs`.
2. `gh pr edit` per repo, injecting a "Linked PRs" block referencing the others + merge order from the plan.

### Schema

Each entry in `linkedPRs[]` is:

```json
{
  "repo": "api",
  "url": "https://github.com/acme/api/pull/311",
  "stackId": null,
  "stackPosition": null,
  "stackedOn": null
}
```

The three stack fields are populated when `/orc:stack-pr` (or `/orc:ship`'s Phase 4.5 size-gate routing into stack-pr) produced this PR as part of a stack:

| Field | Type | Meaning |
|---|---|---|
| `stackId` | `string \| null` | Stable identifier for the stack group. Format: `<sessionId>-<repo>` in workspace mode, `<sessionId>` in single-repo mode. Reused on re-stack of the same branch. |
| `stackPosition` | `int \| null` | 1-indexed position within the stack. Position 1 is the root (stacked on the base branch). |
| `stackedOn` | `string \| null` | URL of the parent PR (position N-1). `null` for position 1 — its parent is the base branch, not another PR. |

**Backward compatibility.** Pre-stack-support entries are `{repo, url}` only. Readers (e.g. `/orc:cleanup`, `/orc:address`) MUST treat missing `stackId`/`stackPosition`/`stackedOn` as `null` and behave identically to a single-PR session. Writers populate all three fields (using `null` when not stacked) so the shape is uniform going forward.

`/orc:cleanup` groups by `stackId` and enforces bottom-up branch deletion (parents merge before children's branches are deletable). `/orc:address` iterates the array unchanged — stack metadata is additive.

Verbose body (matches default ship template):

```
## Linked PRs

This PR is part of a workspace change spanning N repos:

- org/api#311 — this PR
- org/ui#447 — UI changes

Merge order: api → ui (per workspace plan).
```

Caveman variant (matches `caveman-pr` style):

```
## Linked
api#311 (this) · ui#447
order: api → ui
```

Merge order is sourced from the plan's "Repo touchpoints" section; omit the line if the plan didn't specify one.
