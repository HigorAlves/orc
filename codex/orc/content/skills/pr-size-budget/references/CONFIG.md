# Per-repo configuration

The optional `<repo_root>/.orc/pr-budget.json` file: migration handling and the override schema. Read this from [SKILL.md](../SKILL.md) when a repo needs a non-default budget, extra excludes, or migrations counted.

## Migrations

Migrations (`**/migrations/**/*.sql`, `prisma/migrations/**`, `db/migrate/**`) are **excluded by default**, on the theory that auto-generated migration scaffolds must not trigger the gate when the actual code change is small. Override per-repo:

```json
// <repo_root>/.orc/pr-budget.json
{
  "budget": 300,
  "exclude_migrations": false,
  "additional_excludes": ["**/vendor/**", "docs/api-reference/**"]
}
```

If migrations are excluded, the gate prompt always **surfaces the count + LOC of excluded migration files** so the user can object if a 600-LOC migration deserves the conversation.

## Per-repo override file

Path: `<repo_root>/.orc/pr-budget.json`. Optional. Schema:

```json
{
  "budget": 300,
  "exclude_migrations": true,
  "additional_excludes": ["glob/**", "another/glob/**"]
}
```

All keys optional. Missing keys fall through to defaults. `additional_excludes` are pathspec globs (do NOT prepend `:(exclude,glob)` — the helper does it).
