<!-- orc:cleanup/P1 -->
_Loaded on demand (orc:phases protocol). Do not run this phase from memory — this file is the phase._

# Phase 1 — Guard: not inside a candidate

1. Record the current path and branch (commands below).
2. If a session about to be cleaned matches either, stop and print the message below.

```bash
current_path=$(pwd)
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
```

Message: "You're inside the worktree this command would remove. `cd` to the main repo first."
