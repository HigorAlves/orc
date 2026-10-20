<!-- orc:code-review/P8 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 8 — Summary-only output

Reached with `--summary-only`, from the P6 "switch to summary-only" option, or from Audit.

1. Group the findings by severity.
2. Print one line per finding: `path:line — problem — fix`.
3. Post nothing to GitHub.

```markdown
## Bugs
- src/auth.ts:42 — null deref when token absent — guard with `?.` or early return

## Security
- src/api.ts:120 — user input flows into raw SQL — parameterize with `$1`/`$2`

## Tests
- src/billing.ts:55–80 — refund partial-amount branch untested
```
