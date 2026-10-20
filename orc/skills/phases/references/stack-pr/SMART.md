<!-- orc:stack-pr/SMART -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Smart analysis (`--smart`)

Replaces `orc:stack-pr/P3` when the run has `--smart` or the user switched to it there.

1. Dispatch `orc-stack-analyzer` with the inputs below.
2. Read the returned JSON.
3. If `unsplittable: true`, surface the agent's rationale and exit with the suggestion below.
4. Otherwise take the returned slices and rebase plan into `orc:stack-pr/P4`.

```
Agent: orc-stack-analyzer
Inputs:
  branch:    <current_branch>
  base:      <base>
  budget:    <resolved_budget>
  repo:      <repo_name>           # workspace-only
  repoPath:  <repo_path>           # workspace-only
```

Unsplittable suggestion: "open big with reason via `/orc:ship`."

NOTE: never force a split. Analyzer warnings reach the user in `orc:stack-pr/P4`.
