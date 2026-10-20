<!-- orc:stack-pr/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Verify preconditions

1. Invoke `orc:verification-before-completion`: tests pass, lint clean.
2. Per repo, run the four checks below.
3. If any check fails, print a `⚠️ Caution` callout naming the check and repo; stop.
4. If `n_commits == 1`, print the Next callout below and exit 0.

```bash
git status --porcelain                              # must be empty
git rev-list --merges "$base"..HEAD                 # must be empty
n_commits=$(git rev-list --count "$base"..HEAD)     # must be ≥ 2
git rev-list "@{u}..HEAD" --count 2>/dev/null       # should be 0; warn if not
```

Single-commit exit:

```markdown
> **➡️ Next**
>
> Single commit on the branch — nothing to stack. Use `/orc:ship`.
```

NOTE: never try to "fix it for them". The fourth check only warns.
