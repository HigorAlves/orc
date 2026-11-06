# Override reason examples

Read this from the Override syntax section of [SKILL.md](../SKILL.md) when the user picks **"Open as one big PR"** and you need to judge the reason they give.

Examples of acceptable reasons:

- `Auto-generated migration; logic change is 12 LOC.`
- `Vendored upstream library; manual review of vendor diff is the wrong unit.`
- `Hot-fix for prod incident #1842 — review tomorrow morning.`

Examples of **not** acceptable (the reviewer will roll their eyes):

- `It's fine`
- `Doesn't matter`
- (empty)

The skill doesn't lint the reason text — that's a social contract between the engineer and the reviewer. But surfacing the trailer in the PR body makes the override visible.
