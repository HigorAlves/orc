<!-- orc:code-review/P3 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 3 — Dispatch reviewers

1. Always dispatch `orc-pr-reviewer` via `Task`.
2. Match the changed files against the security paths below.
3. If any file matches, dispatch `orc-security-reviewer` in the same response, in parallel.
4. If the user asked to force or skip the security review, obey that instead.
5. Give each agent the inputs listed below, by path, in a brief under 400 words.
6. In multi-PR mode, dispatch one `orc-pr-reviewer` per PR, each with `repo` and `repoPath`.

Security paths:

```
auth/* | session* | login* | password* | token* | jwt* | crypto*
api/* | routes/* | middleware/*
*.sql | migrations/* | db/*
upload* | file* | parser*
deserializ* | exec | eval
package*.json | requirements.txt | go.mod | Cargo.toml
```

Inputs for every agent:

- The PR ref.
- The diff path.
- The standards file paths from P1.
- Any `--context` text.

`orc-pr-reviewer` also gets the spec content from P1 when found.

NOTE: brief discipline per `orc:dispatching-parallel-agents`: pass content by path, never inline the diff. Both agents return strict JSON per `orc:review-contract` (`summary`, `findings[]`).
