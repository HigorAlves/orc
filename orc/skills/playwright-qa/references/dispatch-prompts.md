# Dispatch prompts — Playwright agents

Fill the `<…>` placeholders, then pass the block body as the `Task` prompt. Step-title convention everywhere: `AC <sliceId>.<idx> — <criterion>`.

## planner

Agent: `playwright-test-planner`

```
Use the seed test `<dir>/tests/seed.spec.ts` (it logs in via storageState — do not plan a login scenario). Target: `<name>` at <baseUrl>; guard=<true|false>. Explore the running app and produce a test plan for: <feature description>.
The plan MUST contain exactly one scenario per acceptance criterion below, plus a golden-path scenario titled "<feature> golden path @golden" and the reachable edge cases (validation error, empty state, failure state). In every scenario, write each criterion's proving step as `AC <sliceId>.<idx> — <criterion>` verbatim. Append `@mutating` to the title of any scenario that creates, updates, or deletes data.
Acceptance criteria:
<for each: `- AC <sliceId>.<idx> — <criterion>`>
Save the plan with planner_save_plan as `<dir>/specs/<feature-slug>.md`; test files go under `<dir>/tests/<feature-slug>/`.
```

## generator

Agent: `playwright-test-generator`

```
Generate the test for scenario "<scenario title>" from `<dir>/specs/<feature-slug>.md` (seed: `<dir>/tests/seed.spec.ts`; save to `<dir>/tests/<feature-slug>/<scenario-slug>.spec.ts`). Rules beyond the plan: import `{ test, expect }` from '../fixtures'; keep the scenario title verbatim including its `@golden`/`@mutating` tag; wrap every plan step whose text starts with `AC ` in `await test.step('<that exact step text>', async () => { … })` (title form `AC <sliceId>.<idx> — <criterion>`) and leave other steps as plain code with the `// N. <step>` comment; one test per file.
```

## healer

Agent: `playwright-test-healer`

```
Debug and fix the failing Playwright test "<test title>" (`<file>`; results at `<qa-dir>/pw/results.json`, config `<cfg>`). Edit only files under `<dir>/tests/`. Keep every `test.step('AC <sliceId>.<idx> — <criterion>')` title unchanged. If the application behaviour is wrong rather than the test, mark the test `test.fixme()` with a comment starting `APP BUG:` describing what happens instead of the expectation, and stop.
```
