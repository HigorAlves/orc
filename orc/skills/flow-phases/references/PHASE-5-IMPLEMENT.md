# /orc:flow — Phase 5-IMPLEMENT

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


Two modes, picked by the `--pause-at-implement` flag:

#### Default: dispatch `orc-implementer` (autonomous)

Group slices into **dispatch batches from the ledger** — `slices.json` (installed at plan approval; shape per `orc:state-protocol`) carries `parallelGroup`, `dependsOn`, and `touchpoints` per slice, so independence is declared, never re-derived here. No ledger (pre-ledger plan) → fall back to reading plan.md headers.

**Workspace mode pre-step:** group slices by their `repo:` tag first. Each repo group gets its own implementer dispatch chain. Repo groups run in parallel with each other (one implementer per repo, simultaneously). Within each repo group, the existing sequential/parallel-batch logic applies. The outer loop is `for repo in targetRepos: dispatch implementer(s)`. Each implementer receives `repo`, `repoPath: <workspaceRoot>/<repo>` (or its worktree path), `siblingRepos: [<other targets>]`, and (when present) `crossRepoContract: <plan section pointer>`. **Sibling implementers must not touch each other's files** — the worktree path boundary already guarantees this.

After grouping by repo, for each repo's slices:

- A **sequential batch** is a `parallelGroup` with one slice. Run as a single implementer dispatch with that slice.
- A **parallel batch** is a `parallelGroup` with N slices (pairwise-disjoint `touchpoints` by construction). Dispatch N implementer instances **in parallel** (single response, multiple `Task` calls), each receiving a 1-slice list, its slice's `touchpoints` as the file-ownership boundary, and `mode: parallel` so they return diffs instead of committing. Sanity-validate declared disjointness before dispatching — a violation means the plan annotations are wrong; surface it.

Iterate groups in ascending order. After each batch:
- Sequential: implementer already committed and set its slice `committed` in the ledger; advance.
- Parallel: **persist each returned diff + report first** — `${ORC_STATE_DIR}/<branch>/files/slices/slice-NN.diff` + `slice-NN-report.md` (per `orc:state-protocol`; a crash between collection and apply re-applies from disk instead of re-dispatching implementers) — then apply them in group order via `orc:git-commit` (one commit per slice, in order), run the full suite once after all diffs are applied to confirm green, then `orc-state slice set <id> --status committed --commit <sha>` per slice.

**Phase 5 → 6 advance is a query, not a claim**: `orc-state slice list --status pending,red,escalated` must exit clean. A non-empty result blocks the advance and surfaces the stragglers — a stale ledger fails safe.

Each implementer instance gets:
- The plan path (`${ORC_STATE_DIR}/<branch>/files/plan.md`) or diagnosis path for bugs.
- The workspace directory (per-repo `.orc/<branch>/files/` for `progress.md` writes; in workspace mode also the workspace-level `<workspaceRoot>/.orc/<branch>/files/`).
- The current branch + worktree path.
- Its assigned slice list (1 slice in parallel mode, N in sequential).
- The file-ownership boundary for those slices.
- The failing test from Phase 4 (if slice 1 is in the list).
- Project test/lint/type-check commands (auto-detected from `package.json`, `Makefile`, etc.).
- Mode flag: `mode: sequential` (default) or `mode: parallel` (for parallel-batch members).
- **Workspace mode only**: `repo`, `repoPath`, `siblingRepos`, optional `crossRepoContract`. The slice list is pre-filtered to slices tagged `repo: <name>`.

The agent then drives its assigned slice(s): read spec → write/confirm failing test → implement → run test green → run full suite → lint/type-check → refactor → commit (sequential) or return diff (parallel) → bump checkpoint → next slice in its list.

The agent runs without further user gates UNLESS one of the **escalation conditions** triggers (see `agents/orc-implementer.md`):

- A test can't be made green after 3 attempts.
- A slice spec is ambiguous (multiple valid implementations).
- A new dependency needs to be installed.
- The slice requires touching files outside its declared scope.
- A pre-existing test breaks unexpectedly.
- A security/architecture concern surfaces mid-implementation.
- The plan is wrong (the slice as written would produce incorrect behavior).

When the agent escalates, re-print BOTH blocks it emitted verbatim — the `[!CAUTION]` **🛑 Escalation** callout AND its context fence (file:line evidence + the option definitions; see `agents/orc-implementer.md`) — then `AskUserQuestion`:

```
A. <option A from agent>
B. <option B from agent>
C. Pause flow — I'll come back to /orc:flow
```

User picks → re-dispatch the agent with the resolution, or pause the flow.

When the agent reports all slices complete, advance to Phase 6 (QA) automatically — no extra gate needed (you can pre-approve advance via the agent's status echo, or the umbrella's Phase 6 will gate before running QA anyway).

#### Opt-out: `--pause-at-implement` (human writes the code)

If the flag is passed, fall back to the original behavior:

```
checkpoint.md → phase=5, status=ready-for-implementation, last_artifact=<test-file>:<line>
progress.md → "Implementation phase started. Run /orc:flow again (or /orc:resume) when ready for QA."
```

Echo to the user — the handoff callout (a `[!TIP]`, not a Gate: flow exits here, no question follows), then the details in a fence:

```markdown
> **➡️ Next**
>
> orc paused (`--pause-at-implement`). Re-run `/orc:flow` (or `/orc:resume`) when you're done implementing and flow picks up at QA.
```

```
Worktree:     <path>
Failing test: <file>:<line>
Plan:         .orc/<branch>/files/plan.md
```

Remind: the PreToolUse hook keeps you off main — commit per slice (Conventional Commits via `orc:git-commit`).

The next invocation of `/orc:flow` (or `/orc:resume`) reads the checkpoint and jumps to phase 6.

