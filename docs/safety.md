# Is orc safe to use?

Short answer: **yes, and you can verify every claim below in this repo in about five minutes.** orc is a workflow layer, not a service. It has no backend and it does not phone home.

> [!NOTE]
> **What orc is, and is not.** orc is an MIT-licensed, open-source plugin you run on top of Claude Code and audit yourself. It is not a SaaS, not a code host, and makes no SOC2 or vendor-SLA claims. "Safe to use" here means local, guardrailed and auditable, not vendor-backed.

## It runs on your machine

- **No orc servers. No telemetry. No analytics.** There is no tracking SDK anywhere in the tree; grep for it.
- **Network activity is limited and legible:** GitHub, to fetch the plugin and CLI releases, and any MCP servers you explicitly add. Nothing else.
- **Your work-memory is local and git-ignored** (`graphify-out/`). It never leaves your repo.

## The iron rules

Eight rules, injected at every session start by the `using-orc` skill. The hooks enforce the ones a hook can reach; the commands and agents carry the rest.

1. No commits to `main`, `master` or `develop`. The hook downgrades them to a confirm prompt; approve only with explicit consent.
2. No code without a failing test first.
3. No claims without verification: run the command, read the output.
4. No fixes without a found root cause.
5. No AI attribution in code, commits or PRs.
6. No multi-phase work without `.orc/` checkpoints.
7. No silent broadcast in workspace mode: repo-touching commands need an explicit target flag or a confirming prompt.
8. No PR over the size budget (default 300 LOC) without a recorded choice: stack it, record a `Size-budget-override:` trailer, or abort.

## Guardrails enforced by hooks, not vibes

Every rule below is a short, readable shell script under [`orc/hooks/scripts/`](../orc/hooks/scripts) that Claude Code runs as a real hook, not a suggestion the model can talk itself out of. The PreToolUse guards carry `onFailure: "block"`: a missing or timed-out guard script blocks the git command instead of letting it through, and CI (`verify-hooks.sh`) refuses a guard without it.

| Guardrail | What it does | Enforced by |
|-----------|--------------|-------------|
| **No commits to protected branches** | Intercepts `git commit` and `git push` on `main`/`master`/`develop` and downgrades them to a one-keystroke confirm prompt, with no env-var escape hatch | [`pre-commit-branch-check.sh`](../orc/hooks/scripts/pre-commit-branch-check.sh) |
| **Destructive git gated** | Downgrades `git reset --hard`, `git clean -f`, `git branch -D` and `git push --force` to a confirm prompt (`--force-with-lease` passes untouched) | [`pre-destructive-git-check.sh`](../orc/hooks/scripts/pre-destructive-git-check.sh) |
| **No AI attribution in your history** | Refuses `git commit` and `gh pr/issue create/edit` whose text contains `Co-Authored-By: Claude`, `Generated with Claude Code`, the 🤖 marker, or `noreply@anthropic.com` | [`pre-commit-no-ai-attribution.sh`](../orc/hooks/scripts/pre-commit-no-ai-attribution.sh) |
| **One prompt per command** | All three guards run through one dispatcher that merges their verdicts, so a command that trips two checks asks once | [`pre-git-guard.sh`](../orc/hooks/scripts/pre-git-guard.sh) |
| **Dependency pre-flight** | Checks the CLI tools orc relies on at session start and warns, via `systemMessage`, if any are missing | [`session-start-tool-check.sh`](../orc/hooks/scripts/session-start-tool-check.sh) |
| **Rules in every session** | Injects the iron rules and skill routing at `SessionStart`, so discipline is loaded before the first action | [`session-start-using-orc.sh`](../orc/hooks/scripts/session-start-using-orc.sh) |

The optional orc mod (`hooks/mod/`) adds UI and conveniences on top of these scripts and never replaces them; with the mod off, every guardrail behaves the same ([ADR 0002](adr/0002-mod-layered-over-bash-hooks.md)).

## Open and auditable

- **MIT-licensed.** Every guardrail and command is plain text you can read and diff.
- **orc's own supply chain is hardened:** CI runs least-privilege (`permissions: contents: read`), scans every push for secrets ([gitleaks](https://github.com/gitleaks/gitleaks-action)), scans the Go CLI for known vulnerabilities ([govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck)), lints every script, pins its toolchain, and validates the plugin manifest strictly.
- **Evidence, not adjectives:** web changes going through `/orc:qa` must produce a real artifact packet (screenshots, recording, accessibility snapshot, console log, network HAR, narrated steps) before "QA passed" is an accepted claim.
- **Guard hooks are smoke-tested:** 55 CI cases feed real commands through the scripts and assert the verdict, so a regex change cannot silently drop a rule.

## FAQ

<details>
<summary><strong>Does orc send my code or prompts to any "orc" server?</strong></summary>

No. There is no orc backend and no telemetry; nothing in the tree tracks usage. Your prompts and code go only where Claude Code itself sends them. orc's own network activity is limited to GitHub (fetching the plugin and CLI releases) and any MCP servers you explicitly add.
</details>

<details>
<summary><strong>Can orc commit to <code>main</code> or force-push without me?</strong></summary>

No. A PreToolUse hook (`pre-commit-branch-check.sh`) intercepts `git commit` and `git push` on `main`/`master`/`develop` and downgrades them to a confirm prompt that needs your keystroke, with no env-var escape hatch. The protected branch list is configurable (`protected_branches`). A second hook (`pre-destructive-git-check.sh`) applies the same confirm-prompt gate to `git reset --hard`, `git clean -f`, `git branch -D` and `git push --force` on any branch. If a guard script is missing or times out, the command is blocked, not allowed.
</details>

<details>
<summary><strong>Will orc put "Generated by AI" or <code>Co-Authored-By</code> in our git history?</strong></summary>

No. A hook (`pre-commit-no-ai-attribution.sh`) refuses any `git commit` or `gh pr/issue create/edit` whose text contains AI-attribution markers. Your history reads as your team's work. An `ORC_ALLOW_AI_ATTRIBUTION=1` opt-in exists for teams that want the trailers.
</details>

<details>
<summary><strong>What does orc install on a developer's machine?</strong></summary>

The plugin itself is Markdown and shell scripts loaded by Claude Code. Optionally, the `orc` CLI is a single static Go binary. Runtime tools (`git`, `jq` and the recommended set) are installed only when you run `orc doctor --fix`, via your own package manager; orc never bundles or side-loads binaries.
</details>

<details>
<summary><strong>How do we pin and audit a specific version?</strong></summary>

Pin the marketplace `ref` (in `settings.json`, or via `orc install --ref`) to any existing release tag or a commit SHA. Plugin releases are tagged `orc--vX.Y.Z` and their notes come from `CHANGELOG.md`; CLI releases are tagged `vX.Y.Z` and published by goreleaser with a `checksums.txt`. Everything that runs is plain text in this repo: clone a tag and diff it.
</details>

<details>
<summary><strong>Who maintains it, and is it "production-grade"?</strong></summary>

orc is an open-source personal project (MIT), maintained in the open and used daily by its author. Its CI gates every change with tests, lint, secret scanning, Go vulnerability scanning, strict manifest validation and a nightly behavioural eval suite. It is not a vendor product with an SLA; "safe to use" means auditable, local and guardrailed, so you can adopt it on your own terms. What is accepted and what was rejected: [SCOPE.md](../SCOPE.md).
</details>
