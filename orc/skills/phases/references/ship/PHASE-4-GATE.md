<!-- orc:ship/P4 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 4 — Branch completion + PR preview (one gate)

1. Invoke `orc:finishing-a-development-branch` in its caller-supplied preview mode.
2. Pass the composed title and body from orc:ship/P3.
3. Let the skill render the preview and ask its ONE question (options below).
4. At `--auto=full` with `prMode` settled, open as previewed without asking.
5. In that case, echo the settled-decision line.
6. At `guided` or `manual`, always ask.
7. If the outcome is "open PR" and `--no-size-gate` is absent, Read `orc:ship/P4.5`.
8. If the outcome is "open PR" and `--no-size-gate` is present, Read `orc:ship/P5`.
9. For any other outcome, follow the skill's follow-up for that path.

Options, one `AskUserQuestion`:

- Open as previewed.
- Open as draft.
- Edit title-body first.
- Another completion path: merge back locally, keep as-is, discard. Follow-up per the skill.

"Open PR" means as-is or draft.

NOTE: the preview shown is the payload posted. `prMode` settled means a contract or a decision (`orc:gates` §6).

NOTE: when `/orc:flow` Phase 7 drives this logic, it skips the completion options (the flow's premise is already "open a PR") and gates only the composed preview. Standalone `/orc:ship` always offers the full set.

NOTE: the size gate at `full` auto-stacks when over budget, or escalates. It never selects the override; that attestation stays human.
