# ADF (Atlassian Document Format) — rich bodies on Jira Cloud

Full detail behind the ADF iron rule in SKILL.md.

## Iron rule: ADF JSON for rich bodies on Jira Cloud

<EXTREMELY-IMPORTANT>
Jira Cloud's REST API v3 stores rich-text fields (description, comments, sub-task bodies) as **ADF (Atlassian Document Format) JSON**. It does not render Markdown, and it does not render wiki markup either — anything you pass as plain text is wrapped in a single text node and shown verbatim. `**bold**`, `# heading`, ` ```code``` `, `h3. Title`, `*bold*`, `{code} … {code}` all come through as literal characters and make tickets look broken.

For anything richer than a single paragraph of plain prose, build an ADF document and pass it via `--description-file ./body.adf.json` (or the equivalent ADF object inside a `--from-json` payload). Generate a starter shape with `acli jira workitem create --generate-json` and look at the `description` field — that is the canonical ADF shape acli expects.

Plain one-line summaries and short single-paragraph descriptions can still be passed as bare strings via `--summary` / `--description`; acli wraps them in an ADF text node for you. Everything else (headings, lists, tables, code blocks, links, bold/italic) is ADF or nothing.
</EXTREMELY-IMPORTANT>

### Minimal ADF skeleton

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    { "type": "paragraph", "content": [
      { "type": "text", "text": "Plain paragraph with " },
      { "type": "text", "text": "bold", "marks": [{ "type": "strong" }] },
      { "type": "text", "text": " and " },
      { "type": "text", "text": "a link", "marks": [{ "type": "link", "attrs": { "href": "https://example.com" } }] },
      { "type": "text", "text": "." }
    ]}
  ]
}
```

### Markdown → ADF node cheatsheet

| Need            | Markdown (do NOT send) | ADF node shape                                                                                          |
|-----------------|------------------------|---------------------------------------------------------------------------------------------------------|
| Heading (1–6)   | `## Section`           | `{ "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section" }] }`    |
| Paragraph       | (default)              | `{ "type": "paragraph", "content": [{ "type": "text", "text": "…" }] }`                                 |
| Bold            | `**bold**`             | text node + `"marks": [{ "type": "strong" }]`                                                            |
| Italic          | `*italic*`             | text node + `"marks": [{ "type": "em" }]`                                                                |
| Strikethrough   | `~~text~~`             | text node + `"marks": [{ "type": "strike" }]`                                                            |
| Inline code     | `` `code` ``           | text node + `"marks": [{ "type": "code" }]`                                                              |
| Code block      | ` ```lang … ``` `      | `{ "type": "codeBlock", "attrs": { "language": "ts" }, "content": [{ "type": "text", "text": "…" }] }`  |
| Link            | `[text](https://…)`    | text node + `"marks": [{ "type": "link", "attrs": { "href": "https://…" } }]`                            |
| Bullet list     | `- item`               | `{ "type": "bulletList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", … }] }] }` |
| Numbered list   | `1. item`              | `{ "type": "orderedList", "content": [{ "type": "listItem", … }] }`                                      |
| Blockquote      | `> quoted`             | `{ "type": "blockquote", "content": [{ "type": "paragraph", … }] }`                                      |
| Horizontal rule | `---`                  | `{ "type": "rule" }`                                                                                     |
| Table           | (none)                 | `{ "type": "table", "content": [{ "type": "tableRow", "content": [{ "type": "tableHeader" \| "tableCell", "content": [{ "type": "paragraph", … }] }] }] }` |
| Mention         | `@user`                | `{ "type": "mention", "attrs": { "id": "<accountId>", "text": "@Name" } }` (inline, inside a paragraph)  |
| Panel/note      | (none)                 | `{ "type": "panel", "attrs": { "panelType": "info" }, "content": [{ "type": "paragraph", … }] }`         |

A few invariants that catch most authoring bugs:

- The root is always `{ "type": "doc", "version": 1, "content": [ … ] }`.
- Inline nodes (`text`, `mention`, `hardBreak`) only live inside a block node like `paragraph`, `heading`, `codeBlock`, or a list item's paragraph.
- `listItem` content is a list of block nodes — almost always at least one `paragraph`.
- `codeBlock.attrs.language` is optional but improves rendering; `panel.attrs.panelType` must be one of `info | note | warning | success | error`.
- Don't use both `code` and other marks on the same text node — Jira drops the others.

### When a PRD/spec arrives as Markdown

Treat `--description-file ./foo.md` as a smell. Either:

1. Convert the Markdown to ADF first and pass `--description-file ./foo.adf.json`, or
2. Build the ADF programmatically (most reliable when the body has tables, code, or many headings).

Renaming a `.md` file to `.json` does **not** make acli parse it as ADF; the file's *contents* must be a valid ADF document.
