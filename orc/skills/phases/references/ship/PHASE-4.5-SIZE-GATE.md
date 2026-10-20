<!-- orc:ship/P4.5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4.5 — Size gate

Defer to `orc:pr-size-budget` for the canonical mechanics. `--no-size-gate` skips this phase entirely (orc:ship/P4).

> **🛑 Outward write**
>
> Options 1 and 2 open a stack of PRs. The gate in step 5 precedes them.

1. For each target repo, run the gate command below.
2. If `verdict: under`, Read `orc:ship/P5`.
3. If `verdict: over`, render the `⛔ Gate — PR size` callout exactly as `orc:pr-size-budget` specifies.
4. Print the breakdown and the exclusions from the gate output.
5. Ask with `AskUserQuestion` (options below).
6. In a flow session, record the per-repo decision in flow's `checkpoint.md`.

Gate command (workspace mode iterates per repo; single-repo runs once):

```bash
base="${ARG_BASE:-$(git symbolic-ref refs/remotes/origin/HEAD --short | sed 's@^origin/@@')}"
orc-pr-size gate --base "origin/$base" ${ARG_MAX_LOC:+--max-loc "$ARG_MAX_LOC"}
```

One call returns `loc:`, `budget:`, `verdict:`, the top-contributors table, and the excluded-files line.

Options, in this order:

**Option 1 — Stack from plan slices (Recommended when shown).** Shown only when the session's `slices.json` ledger exists and every slice is `committed` with a distinct recorded `commit` sha (`orc-state slice list`; no heuristics, the ledger IS the commit↔slice map). Pre-ledger fallback: `n_commits_on_branch == n_slices_in_plan` with best-effort subject match. Uses those per-slice commits as the stack scaffold: load `orc:stack-pr` inline with the commit-based strategy pinned, one PR per slice batch. Records the resulting `linkedPRs[]` entries and **short-circuits orc:ship/P5** for this repo.

**Option 2 — Stack it.** Invoke `/orc:stack-pr` **inline as a skill**: load the `stack-pr` skill in this session and run its phases (`--smart` reshape available). Same short-circuit as option 1, without relying on commit/slice alignment. Recommended when option 1 is hidden.

**Option 3 — Open as one big PR.** Prompt for a one-line reason (free text). Append the trailer below to the PR body, after any Jira / `Closes #N` trailers. Continue to orc:ship/P5 with the augmented body.

**Option 4 — Abort.** Exit non-zero with the hint: "Resize the diff and re-run `/orc:ship`, or run `/orc:stack-pr` directly when ready."

Override trailer:

```
Size-budget-override: <reason>
```

NOTE: this gate is the **single owner** of the size decision; `/orc:flow` Phase 7 never pre-flights it. The `checkpoint.md` record lets `/orc:resume` know the repo already gated.

NOTE: in workspace mode the gate fires per repo inside the `for r in $targetRepos` loop. Each repo gets its own decision; one repo can stack while another opens single. Per-repo `stackId` is `<sessionId>-<repo>` (orc:ship/P5, Pass 1).

Iron rule: never silently exceed the budget. Stack, record the override, or abort.
