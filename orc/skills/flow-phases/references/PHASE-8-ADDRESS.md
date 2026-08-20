# /orc:flow — Phase 8-ADDRESS

_Loaded on demand via orc:flow-phases. Do not run this phase from memory — this file is the phase._


After the PR is open, flow exits — there is nothing to decide until reviewers comment, and the checkpoint already routes the next invocation here (every answer to the old "wait / come back / done" question resolved to exactly this). Echo the handoff instead of asking:

```markdown
> **➡️ Next**
>
> PR open. When reviewer comments arrive, re-run `/orc:flow` (or `/orc:address`) and flow routes to the address loop. After merge, re-run `/orc:flow` for cleanup.
```

On re-invocation with unresolved comments: dispatch `/orc:address` logic in parallel — `orc-code-fixer` + `orc-reply-drafter`. After the address loop completes, loop again if more comments arrive, or advance. On re-invocation with the PR merged and no unresolved comments: advance to Phase 9.

