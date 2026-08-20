---
description: "Audit, survey, and upgrade project dependencies — one-bump-per-commit loop, majors escalated, never auto-applied. Verbs: audit (default) | outdated | upgrade."
argument-hint: "[audit|outdated|upgrade] [pkg | --all-safe] [--prod-only] [--repos a,b | --repo a | --all-repos | --this-repo]"
arguments: [verb]
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Skill
  - Task
  - AskUserQuestion
  - Bash(orc-workspace-detect:*)
  - Bash(osv-scanner:*)
  - Bash(npm:*)
  - Bash(pnpm:*)
  - Bash(yarn:*)
  - Bash(pip:*)
  - Bash(pip-audit:*)
  - Bash(uv:*)
  - Bash(poetry:*)
  - Bash(go:*)
  - Bash(govulncheck:*)
  - Bash(cargo:*)
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git branch --show-current:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git checkout:*)
  - Bash(git restore:*)
  - Bash(jq:*)
  - Bash(command -v:*)
---

# /orc:deps

Dependency hygiene for the current repo: what's vulnerable, what's behind, and how to move — safely. Doctrine lives in `orc:dependency-management` (invoke it first; its references/ carry the exact per-ecosystem commands).

## Arguments

- `audit` (default) — scan for vulnerabilities, report severity-ranked, offer the upgrade loop for fixables.
- `outdated` — survey what's behind; recommend a safe batch.
- `upgrade [pkg | --all-safe]` — run the one-bump-per-commit loop for a named package, or for every safe (patch/minor, in-range) bump.
- `--prod-only` — audit/survey production dependencies only.
- `--repos a,b` / `--repo a` / `--all-repos` / `--this-repo` — workspace-mode targeting. See `orc:workspace-mode`.

## Workflow

### Phase 0 — Detect context

!`orc-workspace-detect --banner`

Context is injected above (`ORC_*` vars are exported for any Bash you run — do not re-run detection). In workspace mode, resolve target repos from flags or `AskUserQuestion` — iron rule: no silent broadcast. Each target repo gets its own report/loop.

### Phase 1 — Resolve verb + ecosystems

`$verb` is the first argument (`audit` when empty). Invoke `orc:dependency-management` and detect ecosystems by lockfile/manifest presence (`package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`, `requirements.txt`/`uv.lock`/`poetry.lock`, `go.mod`, `Cargo.lock`). Check `command -v osv-scanner` — prefer it when installed; else the native scanner per the matching references/ file. A repo can hit multiple ecosystems — run all that match.

### Phase 2 — `audit` (default)

1. Run the scanner(s) per `orc:dependency-management`. Uncommitted lockfile changes → surface first (`git status`), don't audit a dirty tree silently.
2. Render the severity-ranked report (critical → high → moderate → low): package, installed, fixed-in, advisory id, bump class (patch/minor/major), prod vs dev. When criticals exist, lead with:

```markdown
> **🛑 Critical vulnerabilities**
>
> <N> critical finding(s): <pkg@version — advisory id, one per line>. Fix or mitigate before shipping anything from this branch.
```

3. Clean scan → say so with the command output as evidence and stop.
4. Fixable findings exist → `AskUserQuestion`: "Run the upgrade loop for the <N> fixable vuln(s)" / "Only the criticals/highs" / "Report only — I'll handle it". Chosen → jump to Phase 4 with that package list (majors still escalate individually there, never auto-applied).

### Phase 3 — `outdated`

1. Run the outdated survey per ecosystem. Render one table: package, current, wanted (in-range), latest, bump class, prod/dev.
2. Recommend the safe batch (patch + minor). Majors are listed in their own section — each needs its own escalation, never part of a batch.

```markdown
> **➡️ Next steps**
>
> <N> safe bump(s) recommended (patch/minor). Run `/orc:deps upgrade --all-safe` to apply them one commit at a time. <M> major(s) need individual review.
```

### Phase 4 — `upgrade [pkg | --all-safe]`

1. **Resolve the bump list.** Named `pkg` → just that one. `--all-safe` → the patch/minor in-range set from a fresh outdated survey. Arrived from Phase 2 → the fixable-vuln list. Dirty working tree → stop and surface; the loop needs clean commits.
2. **Register the session** (iron rule #6). Determine the branch (`git branch --show-current`), sanitize (`/` → `-`), create `${ORC_STATE_DIR}/<sanitized-branch>/files/`, append an entry to `.orc/orc.json` (`command: "deps"`, `status: in_progress`, `current_phase: 4`, `total_phases: 5`), and write `checkpoint.md` listing the bump queue.
3. **Preview the queue** and gate:

```markdown
> **📋 Bump queue**
>
> <ordered list: pkg current → target (bump class)>. One commit each; full suite runs between bumps; a red suite reverts the bump.
```

`AskUserQuestion`: "Proceed" / "Edit the list" / "Cancel".

4. **The loop** — for each package, strictly per `orc:dependency-management`:
   - **Major bump?** Never auto-apply. Print the gate and ask *per package*:

```markdown
> **⛔ Gate — major bump: <pkg> <current> → <target>**
>
> This is a migration, not a bump. Changelog/migration guide: <link>. Apply now, defer, or skip?
```

   - Apply the bump (lockfile-only when the range allows; exact commands in the ecosystem's references/ file).
   - Run the **existing** full suite. Iron rule #2 note: bumps require no new tests — but a bump that breaks the suite is **reverted** (`git restore` the manifest+lockfile), never forced, never patched around in the same commit. Record the failure in `files/deps-report.md` and continue the queue.
   - Green → commit per `orc:git-commit`: `chore(deps): bump <pkg> from <old> to <new>`. Update `checkpoint.md` (queue position) after each bump so `/orc:resume` can continue mid-queue.

5. **Re-audit** (when the loop started from vulns) and show the before/after delta as evidence per `orc:verification-before-completion`.

### Phase 5 — Checkpoint

Write the final summary to `${ORC_STATE_DIR}/<branch>/files/deps-report.md`: bumps applied, bumps reverted (with the failing test output pointer), majors deferred (with links). Set the session `status: done` in `.orc/orc.json` and checkpoint to done.

## Iron rules

- `audit` and `outdated` are read-only — no lockfile mutations, no commits.
- ONE bump per commit; suite green between bumps; red bump → revert, never force.
- Majors NEVER auto-applied — per-package gate with the changelog/migration link, even under `--all-safe` (majors are excluded from "safe" by definition).
- No "clean"/"complete" claim without command output as evidence.

## Output

- Severity-ranked audit report / outdated table (terminal)
- `upgrade` only: one commit per bump, `.orc/<branch>/files/deps-report.md`, checkpoint + `.orc/orc.json` entry
