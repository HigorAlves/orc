## 2. Plan (planner agent) → plan gate

Dispatch `playwright-test-planner` via `Task` with the prompt in `references/dispatch-prompts.md#planner`: the feature description, the acceptance list (id + text), the target name, the guard flag, the seed `<dir>/tests/seed.spec.ts`, and the spec path `<dir>/specs/<feature-slug>.md`. The planner saves the spec via `planner_save_plan`.

**Plan gate** (soft-inward, header `Plan`; pre-approved under `guided`/`full` with the one-liner `➡️ auto: plan approved — <N> scenarios`): preview = the spec file. Options: **Approve plan (Recommended)** · **Edit, then re-plan** (user edits the file or says what to change; re-dispatch with the delta) · **Skip web QA** (logged, only with rationale).

Re-runs on the same branch with an existing `specs/<feature-slug>.md`: skip planning unless new acceptance criteria appeared (compare criterion ids against the spec's `AC` mentions) — then dispatch the planner with "extend the existing plan, do not rewrite".

## 3. Generate (generator agent)

For each scenario in the spec: dispatch `playwright-test-generator` with `#generator` — includes the mandatory `test.step('AC <sliceId>.<idx> — <criterion>', …)` wrapping rule (one step per criterion moment, plain steps for other actions), the `@golden` / `@mutating` tag rule in the test title, and `import { test, expect } from '../fixtures'`. Run generators for independent scenarios in parallel (`orc-dispatching-parallel-agents`).

## 4. Run

**Scan generated tests first (and again after every heal).** The planner/generator/healer read live page content, so a page can steer the code they write, and that code runs in a process whose environment holds the resolved credentials:

```bash
grep -nE 'process\.env|fetch\(|child_process|require\(|import\(|XMLHttpRequest|\bnet\b|\bhttp\b' "$repoPath/$dir/tests/<feature-slug>/"
```

Any hit ⇒ **stop**: show the lines, `the available user-question tool (or ask in chat)` (header `Tests`): drop the test / keep it (reason logged) / abort QA. Also `git -C "$repoPath" diff --name-only` must list only files under `<dir>/tests/` and `<dir>/specs/`; anything else written by an agent is reverted (`git checkout -- <file>`) and reported.

```bash
export ORC_PW_OUTPUT_DIR="<qa-dir>/pw"   # outside the repo; never committed
# guard=false:
( cd "$repoPath/$dir" && ORC_TARGET_JSON="$(orc-targets resolve <name> [--base-url <override>])" npx playwright test --project=qa )
# guard=true (write the flag literally — a `$( … )` that prints the flag is lost when $guard is unset in a fresh shell):
( cd "$repoPath/$dir" && ORC_TARGET_JSON="$(orc-targets resolve <name> [--base-url <override>])" npx playwright test --project=qa --grep-invert @mutating )
```

Guarded target ⇒ every `@mutating` scenario becomes a manifest `skipped` row with note `guarded target <name>`.

## 5. Heal (healer agent, cap 3 per test)

Any failed test → dispatch `playwright-test-healer` with `#healer`, naming the failing test and `<qa-dir>/pw/results.json`. Re-run `--project=qa` after it returns. **At most 3 heal dispatches per test**; a test still failing, or one the healer marked `test.fixme()`, maps to `result: "fail"` (still failing) or `"skipped"` with the healer's comment as `note` (fixme). The healer may edit only files under `<dir>/tests/` — verify with `git diff --name-only` after each heal and re-run the §4 scan; a hit or an out-of-boundary write stops the loop as in §4.

## 6. Evidence

```bash
orc-qa-video collect --results "$ORC_PW_OUTPUT_DIR/results.json" --qa-dir "<qa-dir>"
orc-qa-video stitch  --results "$ORC_PW_OUTPUT_DIR/results.json" --qa-dir "<qa-dir>" --branch "<sanitized-branch>"   # exit 4 ⇒ "Motion proof: skipped — ffmpeg not installed"
```

Then write `steps.md` (validator template; one `### Scenario <n> — <title>` per test, each listing its steps and the `AC` ids proven) and `qa-manifest.json`:

- `driver: "playwright"`, `target: { name, baseUrl, guard }`
- `artifacts[]`: `qa-<branch>.webm` (role `stitched recording`), `chapters.json`, each `trace-<id>.zip` (role `trace <title>`), each `console-<id>.log`, `pw/results.json`
- `video: { file: "qa-<branch>.webm", chapters: <chapters.json contents> }`
- `acceptance[]`: one row per criterion; `evidence` = `["qa-<branch>.webm#t=<chapter.start>", "trace-<id>.zip"]` of the scenario whose `test.step` title carries the criterion id; `skipped` rows carry the note.
- `curated`: `["qa-<branch>.webm"]`
- `specs`: `["<dir>/specs/<feature-slug>.md"]`, `tests`: the generated spec files (relative to repo) — so the PR comment and ship can link them.

## Iron rules

- No "QA passed" without `qa-manifest.json` + the stitched video (or the stated ffmpeg exemption) + a trace per scenario.
- Generated specs/tests are committed with the change (`e2e/specs/**`, `e2e/tests/**` are budget-excluded per `orc-pr-size-budget`); `<qa-dir>/pw/` is not.
- Credentials: only through `ORC_TARGET_JSON="$(orc-targets resolve …)"` inline in the `npx playwright test` command — never a standalone resolve, never in prompts, packet files, or the manifest (`orc-qa-targets` redaction rules).
