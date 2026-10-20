# Authoring standard

How every orc file is written: commands, agents, skills, phase modules. Adapted from ASD-STE100 (controlled language) and S1000D (data modules) — the standards aircraft maintenance manuals use so a reader with no shared context performs a procedure exactly, every time. An agent reading a command is that reader. Enforced by `scripts/ci/verify-ste.sh` (ratchet: a file may only improve) and the size caps in the same script.

## 1. Controlled vocabulary

- **One word, one meaning.** `GLOSSARY.md` is the restricted vocabulary. Use its term; never a synonym it lists under *Avoid*. A concept that needs a new word goes into the glossary before it goes into a file.
- **Unapproved words.** Replace on sight; the lint fails on them:

| Unapproved | Write instead |
|---|---|
| should | must — or delete the sentence (if it is optional, say when) |
| might, may (possibility) | can — or state the condition |
| leverage, utilize, employ | use |
| ensure, make sure | verify (then say how) |
| in order to | to |
| prior to | before |
| subsequently | then |
| perhaps, maybe | delete; state the condition |
| ascertain | determine |
| terminate | stop |
| approximately | about |
| commence | start |
| facilitate | allow, help |

- **No hedges in steps.** "Consider running the suite" is not an instruction. Either "Run the suite" or a condition: "If the suite is slower than 60 s, run only the changed package."

## 2. Sentence limits

- **Procedural step: 15 words, one action.** A numbered or bulleted line inside a Phase, Workflow, Steps, Process or Mode section. A step that needs more is two steps, or a step plus a NOTE.
- **Descriptive statement: 20 words.** Prose outside steps, and bullets under Arguments, Output, Iron rules, Principles.
- **Qualifiers move out.** Paths, flags and the reason go in a NOTE under the step, or in the Arguments section, not in the step line.
- **Punctuation.** One em-dash per line at most. A second clause is a second sentence.

## 3. Voice and mood

- **Imperative, active, verb first.** "Run `gh pr diff`", "Read the ledger", "Dispatch the reviewer". The lint counts steps that open with `The`, `This`, `If`, `When`, `A`, `An`, `It`.
- **Conditions lead, then the verb.** "If the diff is empty, stop and report." Never "stop and report if…".
- **No passive in steps.** "Findings are merged" hides who merges. "Merge the findings."
- **Name the actor only when it is not the reader.** The command's reader is the agent; "dispatch `orc-pr-reviewer`" needs no subject. "The user picks" names a different actor on purpose.

## 4. Safety hierarchy

Maps onto the callout palette (`orc:callouts`). A notice goes **before** the step it guards, never after.

| Level | Palette | Use for |
|---|---|---|
| WARNING | `🛑 <what>` | irreversible or outward: deletes, pushes, posts, tracker writes, production mutations |
| CAUTION | `⚠️ Caution` | damage to the working tree or a wrong result: dirty worktree, stale ledger, mismatched sha |
| NOTE | `💡 Insight` | a fact the step depends on; why a step exists |

A gate is not a notice: `⛔ Gate` precedes the `AskUserQuestion` it introduces and carries one to three context lines.

## 5. Task anatomy (commands)

Every command file, in this order. The lint checks the headings exist in order; it does not check prose.

```
# /orc:<name>                      one sentence: what the command does
## Arguments                       one bullet per flag, ≤ 20 words each
## Preconditions                   what must be true; the WARNING / CAUTION notices for the whole run
## Phases                          index: one line per phase, module code, when it is skipped
### Phase 0 — Detect context       resident: the banner, repo set, state registration
### Phase 1 — <name>               resident when every run needs it; otherwise a module
## Iron rules                      the non-negotiables, ≤ 20 words each
## Output                          files written, state bumped, what is echoed
```

Tools live in `allowed-tools` frontmatter only; never restated in prose.

**Entry size.** A command entry is at most 6 KB. Phases 2+ live in modules under `orc:phases` (`references/<command>/PHASE-<N>-<NAME>.md`) and load one at a time: "Entering phase N, Read exactly its module." Never run a phase from memory, never read ahead.

**Agents** are at most 8 KB: role, inputs, workflow steps, what you do not do, output contract, iron rules, tone. Reference material an agent needs lives in a skill the agent preloads (`skills:` frontmatter) under that skill's `references/`.

**Skills** are at most 6 KB without a `references/` directory. Past that, disclose: the entry keeps the steps and the reference every branch needs; the rest moves behind a pointer (`orc:writing-for-agents`, Information hierarchy).

## 6. Data modules

- **One module, one phase.** A phase module is self-contained: an agent that reads only it, plus the command's Phase 0 state, can perform the phase.
- **Module code.** The first line of a phase module is its code: `<!-- orc:<command>/P<N> -->`. Cross-references between modules use the code, not prose ("per orc:flow/P5", not "see the implement phase above").
- **Stored once.** A rule two commands share lives in one skill both invoke, never in both commands. `orc:gates`, `orc:callouts`, `orc:state-protocol`, `orc:pr-size-budget` exist for this.
- **Update once.** Changing a phase changes one file; the command entry's phase index names the module, nothing else about it.

## 7. Before and after

From `code-review` Phase 4, before:

> 5. **Self-contradiction detection.** For each agent's `summary`, scan for the strings `["approve", "lgtm", "looks good", "no concerns", "non-blocking"]` (case-insensitive). If matched AND any finding from that agent has severity in `{bug, security, api-surface}` → record a warning to surface in the preview.

After:

> 5. Scan each agent `summary` for an approval phrase (list below).
> 6. If it matches and that agent has a blocking finding, record a Caution for the preview.
>
> Approval phrases: approve, lgtm, looks good, no concerns, non-blocking. Case-insensitive. Blocking severities: `bug`, `security`, `api-surface`.

From `cleanup` Phase 6, before:

> 2. **Worktree** — `git worktree remove <path>` ONLY if clean. If dirty, skip and surface a `**⚠️ Skipped — dirty worktree**` callout. Never use `--force` automatically; require an explicit `--force-dirty` flag in a future iteration if needed.

After:

> ⚠️ Caution: a dirty worktree holds user work.
> 2. If the worktree is clean, run `git worktree remove <path>`.
> 3. If it is dirty, skip it and print `⚠️ Skipped — dirty worktree`.
>
> Never pass `--force`.

From `orc-implementer`, before:

> The caller (`/orc:flow` Phase 5) will collect all parallel results, then merge / sequence the commits in plan order.

After:

> In parallel mode, return the diff and the test report. The caller commits them in plan order.

## 8. The lint

`scripts/ci/verify-ste.sh` runs in `validate.yml`:

- **Hard fail:** an unapproved word; a new file over its size cap; a new file with any step over the limit or not verb-first.
- **Ratchet:** for files in `scripts/ci/precision-baseline.json`, long steps, non-imperative steps, passive lines, bytes and description length may not exceed the recorded value. When a file improves, run `verify-ste.sh --update` so the baseline tightens; the PR carries the new baseline.
- **Report:** `verify-ste.sh --report` prints the worst files, which is what `/orc:retro` reads under coding standards.
