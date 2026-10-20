# GitHub markdown craft

Terse ≠ plain. Use the renderer to carry signal with fewer words. Assumes the Rules in [SKILL.md](../SKILL.md).

- **Auto-links do the work**: bare `#123`, `org/repo#45`, and 7+-char commit shas render as rich links — never paste a URL where a ref auto-links, never write "see PR number 45".
- **Permalinks over prose**: pointing at code? A line permalink (press `y` on the file view) renders an inline code preview — beats describing the location.
- **Fenced code with a language tag**, always — unhighlighted blocks waste the reviewer's eyes.
- **`<details><summary>…</summary></details>` for evidence bulk**: QA artifact lists, benchmark output, long logs. The summary line carries the verdict; the bulk collapses.
- **Tables only for enumerable facts** (flag → effect, before → after) — never for prose in cells.
- **Task lists (`- [ ]`)** only when the repo's PR template requires them — otherwise they're checkbox theater.
- **`[!NOTE]`/`[!WARNING]` callouts** per `orc:callouts` — GitHub-bound output only, and only when the line genuinely must not be missed.
