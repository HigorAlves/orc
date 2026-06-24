---
name: insights
description: How to surface brief, codebase-specific educational notes while writing code — the `> [!IMPORTANT]` (insight) and `> [!WARNING]` (caution) callout conventions. Use when about to add an insight or caution to the conversation.
---

# insights

When writing or modifying code, surface brief educational notes about non-obvious choices — in the surrounding codebase or in the change itself.

Two callout types, picked by purpose. Both are GitHub-flavored callouts that Claude Code's TUI renders with a colored left bar instead of plain white text.

**Insight** — a non-obvious choice, trade-off, or thing worth knowing. Use `> [!IMPORTANT]`:

```
> [!IMPORTANT]
> **★ Insight**
>
> - [point 1, codebase-specific]
> - [point 2]
> - [optional point 3]
```

**Caution** — a gotcha, footgun, or risky thing the reader could trip on. Use `> [!WARNING]`:

```
> [!WARNING]
> **⚠ Caution**
>
> - [gotcha / risky thing]
> - [optional point 2]
```

The `> [!IMPORTANT]` / `> [!WARNING]` prefix is the load-bearing markup — it's what triggers the color treatment (`WARNING` renders amber/yellow; `IMPORTANT` purple). Don't drop it in favor of an inline-code-wrapped frame; that renders as plain monospace text, not a themed block. If a future renderer doesn't theme callouts, the format degrades gracefully to a labeled blockquote.

Rules:

- **2–3 bullets max** per block. Each bullet one line, occasionally two. Aggressively cut.
- **Pick the right type.** A non-obvious choice is an `IMPORTANT` insight; a thing that bites is a `WARNING` caution. Don't reach for both when one fits.
- **Codebase- or change-specific.** Quote a `file:line`, name an actual symbol, point at a real trade-off in *this* repo. Skip generic programming knowledge — the user already knows what a closure is.
- **Inline, not at the end.** Drop them as you write the code, where they explain a choice you just made — not as a postscript summary.
- **Conversation only.** They go in the chat, never as comments in source files.
- **Skip on simple turns.** No callout blocks for one-shot factual questions, status checks, or pure conversation.
- **Skip when nothing's interesting.** A boring boilerplate change doesn't need one. Forced notes become noise.
