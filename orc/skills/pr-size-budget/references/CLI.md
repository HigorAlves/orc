# The CLI — subcommands and library functions

`bin/orc-pr-size` is on PATH while orc is enabled. [SKILL.md](../SKILL.md) shows the one `gate` call that powers the whole gate; read this when a caller needs a single number or table instead, or sources the logic from a hook script.

## Subcommands

| Subcommand | Returns |
|---|---|
| `gate [--base <ref>] [--max-loc <N>]` | One-shot: loc + budget + verdict + breakdown + exclusions. |
| `loc [--base <ref>]` | Integer — net `additions+deletions`, post-exclusion. |
| `breakdown [--base <ref>]` | Markdown table — top-10 contributors by LOC. |
| `excluded [--base <ref>]` | One-line summary of what was excluded. |
| `budget [--max-loc <N>]` | Integer — resolved budget (`--max-loc` > env > config > default). |

## Library functions

For sourcing from hook scripts, `lib/pr-size-budget.sh` still exposes the same logic as functions: `orc_pr_loc`, `orc_pr_loc_breakdown`, `orc_pr_excluded_summary`, `orc_pr_budget`.
