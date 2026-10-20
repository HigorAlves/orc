---
name: pr-size-budget
description: Use when opening a PR or planning slices — defines the soft 300 LOC budget, the exclusion list, the shared gate prompt for ship/flow/stack-pr, and the override syntax.
---

# PR size budget

## Overview

Big PRs starve review quality. orc enforces a **soft iron rule** at PR-creation time: the diff (additions + deletions, post-exclusion) is computed against the base branch and compared to a budget. When over budget, the user picks one of three paths — never silently ignored, never hard-blocked.

This skill is the single source of truth. `/orc:ship`, `/orc:flow`, and `/orc:stack-pr` all call the `orc-pr-size` CLI (plugin `bin/`, on PATH while orc is enabled) and present the gate prompt defined here. If you're tempted to reimplement LOC math or the prompt elsewhere — don't.

**Announce at start:** "I'm using the pr-size-budget skill because this command opens or sizes a PR."

## Budget resolution order

Highest precedence wins:

1. **CLI flag** — `--max-loc <N>` on `/orc:ship`, `/orc:flow`, `/orc:stack-pr`.
2. **Environment** — `$ORC_PR_LOC_BUDGET` (per-shop default, e.g. set in shell init).
3. **Per-repo config** — `<repo_root>/.orc/pr-budget.json#budget`.
4. **Plugin setting** — userConfig `pr_size_budget` (prompted at plugin enable; exported as `CLAUDE_PLUGIN_OPTION_PR_SIZE_BUDGET`). Per-repo intent deliberately beats this per-user default.
5. **Built-in default** — `300`.

`--no-size-gate` bypasses the gate entirely (records nothing in the PR body). Use sparingly — typically only for emergency fixes where review-cycle time is the dominant cost.

## What counts toward the budget

`additions + deletions` of the diff `base...HEAD` (three-dot, the symmetric-difference form `gh pr create` uses), **after applying the exclusion pathspecs**. Modified lines count as `1 add + 1 del = 2 LOC` — same as `git diff --shortstat` reports.

## Default exclusion globs

These never count:

- **Lockfiles** — `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`, `poetry.lock`, `uv.lock`, any `*.lock` / `*.lockb`.
- **Snapshots / generated** — `**/__snapshots__/**`, `**/__generated__/**`, `**/generated/**`, `**/*.gen.{ts,go}`, `**/*.pb.{go,ts}`, `**/*_pb2.py`.
- **Build artifacts** — `**/dist/**`, `**/build/**`, `**/.next/**`.
- **Generated browser-QA proof** — `e2e/specs/**`, `e2e/tests/**` (Playwright plans + tests written by `/orc:qa`'s planner/generator; reviewers see them, the budget doesn't count them).

## Migrations and per-repo config

Migrations (`**/migrations/**/*.sql`, `prisma/migrations/**`, `db/migrate/**`) are **excluded by default**; the gate prompt always surfaces the count + LOC of excluded migration files. Read [CONFIG.md](references/CONFIG.md) when a repo needs `<repo_root>/.orc/pr-budget.json` — the schema for `budget`, `exclude_migrations`, `additional_excludes`.

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

Before the prompt, **always** print the Gate callout (per the `orc:callouts` terminal palette — **⛔ Gate — PR size**, no `[!TYPE]` tag), then the breakdown in a fence (never inside the callout — blockquotes reflow and break alignment):

```markdown
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

Acceptable and unacceptable reasons, with why the trailer stays unlinted: [OVERRIDE-EXAMPLES.md](references/OVERRIDE-EXAMPLES.md).

## The CLI (`bin/orc-pr-size`, on PATH while orc is enabled)

One call powers the whole gate:

```bash
base=$(git symbolic-ref refs/remotes/origin/HEAD --short | sed 's@^origin/@@')
orc-pr-size gate --base "origin/$base" ${ARG_MAX_LOC:+--max-loc "$ARG_MAX_LOC"}
# → base:/loc:/budget:/verdict: lines, then the top-10 breakdown table,
#   then the excluded-files one-liner.
# verdict: over → render the "⛔ Gate — PR size" callout from
# "The gate prompt" section above, then AskUserQuestion as above.
```

Other subcommands (`loc`, `breakdown`, `excluded`, `budget`) and the `lib/pr-size-budget.sh` functions for hook scripts: [CLI.md](references/CLI.md).

## Workspace mode

In workspace mode, the gate fires **per repo**, not per workspace. Each `gh pr create` in the per-repo loop runs its own size-gate computation against the per-repo `base`. One repo can stack while another opens single — they're independent decisions.

Per-repo config files (`<repo>/.orc/pr-budget.json`) take precedence over the workspace-level default.

## Iron rule

This skill exists because of **`using-orc` Rule 8: No PR over the size budget without a recorded choice**. The choice is always one of: stack, big-with-reason trailer, or abort. There is no fourth option of "ignore the gate." `--no-size-gate` exists as an escape hatch for emergencies — it is not a daily-driver flag.
