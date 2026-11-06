# Codex smoke test evidence

Run date: 2026-11-06 UTC. Host: macOS, Codex CLI 0.166.0.
Package: local `orc@orc-codex` 0.31.0 from the implementation checkout.
These results cover the generated package, not the previously published release.

## Method

Registered the checkout with `codex plugin marketplace add`, installed it with
`codex plugin add`, and ran real `codex exec` sessions using the existing login.
Workflow sessions used disposable Git repositories and the workspace-write
sandbox; the separate specialist-review session used the read-only sandbox.
Reviewed plugin hooks were enabled with the documented one-invocation hook-trust
flag. This validates hook execution, not the interactive hook-trust dialog.
No push, PR, issue, tracker write, or release was permitted.

## Results

- Local installation and enabled-state discovery passed.
- Installed package matched all 896 generated files byte-for-byte.
- A real session discovered plan, QA, ship, resume, and flow entrypoints and read
  the installed runtime and resume references.
- On `main`, `git commit --allow-empty -m smoke-guard` was blocked by the actual
  PreToolUse hook. HEAD remained the initial fixture commit.
- A safe `python3 -m unittest -v` command passed in the same session.
- Planning on a prepared feature branch passed: one slice, baseline test green,
  unchanged source files, valid state, and a visible P4 approval gate.

- Fresh-session resume recovered the plan, reused explicit approval, and installed
  the slice ledger without repeating the approval gate.
- TDD evidence captured the expected missing-function failure (exit 1), followed
  by all five unittest methods passing (exit 0).
- Code-mode QA wrote test logs, review, manifest, and a passing verdict with all
  five acceptance criteria evidenced. No lint/typecheck was configured.
- Ship preflight stopped at the uncommitted-changes gate. HEAD was unchanged;
  no commit, push, or publication occurred.
- The installed compaction handler accepted a representative event payload,
  wrote an auto-checkpoint, preserved the resume digest, and passed state
  verification. This was a handler smoke test, not a host-triggered compaction.

The ephemeral resume session could not start a subagent: the host returned
`no rollout found`. The runtime disclosed the failure and correctly used its
sequential fallback. A separate persistent-session test successfully dispatched the bundled reviewer
with fresh context and the inherited model. The saved session trace contains
both started/completed SubAgentActivity events and the reviewer's final message:
no findings, five tests passed, no edits or publication. Use persistent sessions
for agent-dispatch smoke tests; ephemeral-mode fallback was also exercised.

## Issues exposed and corrected

- Claude inline shell preprocessing and injected environment assumptions:
  converted to explicit commands and per-shell environment setup.
- Inherited `superpowers:*` dependencies: mapped to bundled orc workflows and
  implementer/reviewer roles. Regression checks reject remaining references.
- An unattended sandbox denied branch creation while a multi-command shell
  continued to initialize state. Runtime guidance now requires separate Git
  mutations, exit-status checks, and branch verification before state writes.
  The successful rerun used a prepared branch; unattended branch escalation
  remains subject to the host's approval policy.

The first failed branch attempt also exposed the shared CLI's existing behavior:
re-running `orc-state init --plan-file` does not replace an existing plan path.
The failed fixture was discarded for acceptance purposes; the clean rerun used
consistent branch and plan paths.

## Desktop boundary

No Codex or ChatGPT desktop installation was found in the standard application
locations. JetBrains Air is installed; Rex had no connected desktop client.
Desktop UI discovery, hook trust, and interactive workflow execution remain
unverified. CLI results do not establish desktop UI compatibility.

## Local evidence

Raw session events and final reports remain under `/private/tmp/`:
`orc-smoke-discovery`, `orc-smoke-rerun-plan`, `orc-smoke-resume`, and
`orc-smoke-agent` (`.jsonl` events and `.txt` summaries). The accepted fixture is
`/private/tmp/orc-codex-rerun-_ipeulsh`; its `.orc/feat-subtract/files/` contains
plan, checkpoint, red/green logs, QA verdict, and ship-preflight evidence.
Temporary evidence is not part of the distributable plugin.

## Pre-PR review follow-up

Review found that blanket filename rewriting changed skill-authoring instructions.
Supporting files now retain `SKILL.md` outside the discoverable entrypoint tree.
A Codex-specific Playwright preflight now selects agent-browser before unsupported
provisioning; preconfigured projects retain the shared guarded execution and
evidence stages. Nine bundle regression tests pass after these corrections.
These changes were verified by package/reference tests and review; the earlier
live workflow sessions preceded this follow-up.

The broader pre-PR checks pass for repository verification scripts, shellcheck,
Go tests, and strict Claude manifest validation. On locally installed Claude
Code 2.1.317, mod tests produce 316 pass / 7 fail. An isolated archive of unchanged
`main` produces the same 316 pass / 7 fail; these are existing harness failures,
not new Codex changes. CI pins Claude Code 2.1.290.
