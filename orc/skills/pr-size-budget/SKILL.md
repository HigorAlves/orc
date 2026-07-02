---
name: pr-size-budget
description: Use when opening a PR or planning slices — defines the soft 300 LOC budget, the exclusion list, the shared gate prompt for ship/flow/stack-pr, and the override syntax.
---

# PR size budget

## Overview

Big PRs starve review quality. orc enforces a **soft iron rule** at PR-creation time: the diff (additions + deletions, post-exclusion) is computed against the base branch and compared to a budget. When over budget, the user picks one of three paths — never silently ignored, never hard-blocked.

This skill is the single source of truth. `/orc:ship`, `/orc:flow`, and `/orc:stack-pr` all source `lib/pr-size-budget.sh` and present the gate prompt defined here. If you're tempted to reimplement LOC math or the prompt elsewhere — don't.

**Announce at start:** "I'm using the pr-size-budget skill because this command opens or sizes a PR."

## Budget resolution order

Highest precedence wins:

1. **CLI flag** — `--max-loc <N>` on `/orc:ship`, `/orc:flow`, `/orc:stack-pr`.
2. **Environment** — `$ORC_PR_LOC_BUDGET` (per-shop default, e.g. set in shell init).
3. **Per-repo config** — `<repo_root>/.orc/pr-budget.json#budget`.
4. **Built-in default** — `300`.

`--no-size-gate` bypasses the gate entirely (records nothing in the PR body). Use sparingly — typically only for emergency fixes where review-cycle time is the dominant cost.

## What counts toward the budget

`additions + deletions` of the diff `base...HEAD` (three-dot, the symmetric-difference form `gh pr create` uses), **after applying the exclusion pathspecs**. Modified lines count as `1 add + 1 del = 2 LOC` — same as `git diff --shortstat` reports.

## Default exclusion globs

These never count:

- **Lockfiles** — `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`, `poetry.lock`, `uv.lock`, any `*.lock` / `*.lockb`.
- **Snapshots / generated** — `**/__snapshots__/**`, `**/__generated__/**`, `**/generated/**`, `**/*.gen.{ts,go}`, `**/*.pb.{go,ts}`, `**/*_pb2.py`.
- **Build artifacts** — `**/dist/**`, `**/build/**`, `**/.next/**`.

## Migrations

Migrations (`**/migrations/**/*.sql`, `prisma/migrations/**`, `db/migrate/**`) are **excluded by default**, on the theory that auto-generated migration scaffolds shouldn't trigger the gate when the actual code change is small. Override per-repo:

```json
// <repo_root>/.orc/pr-budget.json
{
  "budget": 300,
  "exclude_migrations": false,
  "additional_excludes": ["**/vendor/**", "docs/api-reference/**"]
}
```

If migrations are excluded, the gate prompt always **surfaces the count + LOC of excluded migration files** so the user can object if a 600-LOC migration deserves the conversation.

## Per-repo override file

Path: `<repo_root>/.orc/pr-budget.json`. Optional. Schema:

```json
{
  "budget": 300,
  "exclude_migrations": true,
  "additional_excludes": ["glob/**", "another/glob/**"]
}
```

All keys optional. Missing keys fall through to defaults. `additional_excludes` are pathspec globs (do NOT prepend `:(exclude,glob)` — the helper does it).

## The gate prompt (canonical)

When `loc > budget`, the calling command MUST surface this `AskUserQuestion` shape (paraphrased per command — `/orc:flow` adds a fourth option; the first three are identical everywhere):

> **Question:** "This PR is **{loc} LOC** vs the **{budget} LOC** budget. How would you like to proceed?"
>
> **Header:** `PR size`
>
> **Options:**
>
> 1. **Stack it (Recommended)** — Hand off to `/orc:stack-pr` to break this into a stack of smaller PRs. Reviewers can approve incrementally.
>
> 2. **Open as one big PR** — Requires a one-line reason. Reason is recorded as a `Size-budget-override:` trailer in the PR body.
>
> 3. **Abort** — Go back to the implementation, resize, then re-run.

Before the prompt, **always** print the Gate callout (per the `orc:insights` palette — `[!WARNING]` because the gate fired on a problem), then the breakdown in a fence (never inside the callout — blockquotes reflow and break alignment):

```markdown
> [!WARNING]
> **⛔ Gate — PR size**
>
> Diff vs <base>: **<loc> LOC** across <N> files vs the **<budget> LOC** budget — OVER by <loc - budget> LOC.
```

```
Top contributors:
<orc_pr_loc_breakdown table — first 10 files>

<orc_pr_excluded_summary one-liner>
```

This is non-negotiable: the user cannot make an informed choice without seeing where the LOC went and what was already discounted. The breakdown is what stops "the budget is too low" complaints — usually the answer is "no, you have an 800-line config file in this PR."

## Override syntax

When the user picks **"Open as one big PR"**, prompt for a one-line reason via free-text input (use `AskUserQuestion` with `Other` as the path). Reason MUST be non-empty. Append to the PR body as a trailer (after any Jira / `Closes #N` trailers):

```
Size-budget-override: <reason>
```

Examples of acceptable reasons:

- `Auto-generated migration; logic change is 12 LOC.`
- `Vendored upstream library; manual review of vendor diff is the wrong unit.`
- `Hot-fix for prod incident #1842 — review tomorrow morning.`

Examples of **not** acceptable (the reviewer will roll their eyes):

- `It's fine`
- `Doesn't matter`
- (empty)

The skill doesn't lint the reason text — that's a social contract between the engineer and the reviewer. But surfacing the trailer in the PR body makes the override visible.

## Helper functions (from `lib/pr-size-budget.sh`)

Source the helper, then use:

```bash
. "${CLAUDE_PLUGIN_ROOT}/lib/pr-size-budget.sh"

base=$(git symbolic-ref refs/remotes/origin/HEAD --short | sed 's@^origin/@@')
loc=$(orc_pr_loc "origin/$base")
budget=$(orc_pr_budget "$ARG_MAX_LOC")     # CLI override > env > .orc/pr-budget.json > 300

if [ "$loc" -gt "$budget" ]; then
  echo "PR size gate"; echo
  echo "Diff vs origin/$base:"
  echo "  Counted: $loc LOC"
  echo "  Budget:  $budget LOC"
  echo "  Verdict: OVER by $((loc - budget)) LOC"
  echo
  echo "Top contributors:"
  orc_pr_loc_breakdown "origin/$base"
  echo
  orc_pr_excluded_summary "origin/$base"
  # ...then AskUserQuestion as above
fi
```

Functions exposed:

| Function | Returns |
|---|---|
| `orc_pr_loc <base> [<repo_root>]` | Integer — net `additions+deletions`, post-exclusion. |
| `orc_pr_loc_breakdown <base> [<repo_root>]` | Markdown table — top-10 contributors by LOC. |
| `orc_pr_excluded_summary <base> [<repo_root>]` | One-line summary of what was excluded. |
| `orc_pr_budget [<override>]` | Integer — resolved budget (CLI > env > config > default). |

## Workspace mode

In workspace mode, the gate fires **per repo**, not per workspace. Each `gh pr create` in the per-repo loop runs its own size-gate computation against the per-repo `base`. One repo can stack while another opens single — they're independent decisions.

Per-repo config files (`<repo>/.orc/pr-budget.json`) take precedence over the workspace-level default.

## Iron rule

This skill exists because of **`using-orc` Rule 8: No PR over the size budget without a recorded choice**. The choice is always one of: stack, big-with-reason trailer, or abort. There is no fourth option of "ignore the gate." `--no-size-gate` exists as an escape hatch for emergencies — it is not a daily-driver flag.
