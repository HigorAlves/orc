---
name: insights
description: How to surface brief, codebase-specific educational notes while writing code — the `> [!IMPORTANT]` callout convention. Use when about to add an insight to the conversation.
---

# insights

When writing or modifying code, surface brief educational notes about non-obvious choices — in the surrounding codebase or in the change itself.

Use this exact format — a GitHub-flavored `IMPORTANT` callout so Claude Code's TUI renders it with a colored left bar (typically purple) instead of plain white text:

```
> [!IMPORTANT]
> **★ Insight**
>
> - [point 1, codebase-specific]
> - [point 2]
> - [optional point 3]
```

The `> [!IMPORTANT]` prefix is the load-bearing markup — it's what triggers the color treatment. Don't drop it in favor of an inline-code-wrapped frame; that renders as plain monospace text, not a themed block. If a future renderer doesn't theme callouts, the format degrades gracefully to a labeled blockquote.

Rules:

- **2–3 bullets max.** Each bullet one line, occasionally two. Aggressively cut.
- **Codebase- or change-specific.** Quote a `file:line`, name an actual symbol, point at a real trade-off in *this* repo. Skip generic programming knowledge — the user already knows what a closure is.
- **Inline, not at the end.** Drop insights as you write the code, where they explain a choice you just made — not as a postscript summary.
- **Conversation only.** Insights go in the chat, never as comments in source files.
- **Skip on simple turns.** No insight blocks for one-shot factual questions, status checks, or pure conversation.
- **Skip when nothing's interesting.** A boring boilerplate change doesn't need an insight. Forced insights become noise.
