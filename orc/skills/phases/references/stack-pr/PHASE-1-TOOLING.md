<!-- orc:stack-pr/P1 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 1 — Detect tooling

1. Run the detection below and record `STACK_TOOL`.
2. If `STACK_TOOL` is `none`, ask with `AskUserQuestion` using the options below.
3. On "Install", run `gh extension install github/gh-stack`, then continue.
4. On "Use plain-gh fallback", record it; P5 chains PRs with `gh pr create --base <prev-branch>`.
5. On "Cancel", stop.

```bash
if command -v gh-stack >/dev/null 2>&1; then
  STACK_TOOL="gh-stack"
elif gh stack --help >/dev/null 2>&1; then
  STACK_TOOL="gh-stack-ext"
else
  STACK_TOOL="none"
fi
```

`AskUserQuestion` options:

1. **Install** — run `gh extension install github/gh-stack`. Continue when complete.
2. **Use plain-gh fallback** — chain via `gh pr create --base <prev-branch>` per layer. No extension needed.
3. **Cancel.**

NOTE: never auto-install.
