---
name: insights
description: How to surface brief, codebase-specific educational notes while writing code — the `> [!IMPORTANT]` (insight) and `> [!WARNING]` (caution) callout conventions. Use when about to add an insight or caution to the conversation.
---

# insights

When writing or modifying code, surface brief educational notes about non-obvious choices — in the surrounding codebase or in the change itself.

Two callout types, picked by purpose. They're GitHub-flavored callouts: on GitHub and in editors like VS Code they render as colored admonitions (insight purple, caution amber/red). The Claude Code terminal does **not** theme the callout bar — there they degrade to a plain blockquote, so the leading emoji (`💡` / `⚠️`) is what carries color in the TUI.

**Insight** — a non-obvious choice, trade-off, or thing worth knowing. Use `> [!IMPORTANT]`:

```
> [!IMPORTANT]
> **💡 Insight**
>
> - [point 1, codebase-specific]
> - [point 2]
> - [optional point 3]
```

**Caution** — a gotcha, footgun, or risky thing the reader could trip on. Use `> [!WARNING]`:

```
> [!WARNING]
> **⚠️ Caution**
>
> - [gotcha / risky thing]
> - [optional point 2]
```

The `> [!IMPORTANT]` / `> [!WARNING]` prefix is the load-bearing markup for rich renderers (GitHub, VS Code) — it's what triggers the colored admonition. The Claude Code TUI ignores the alert type and shows a plain blockquote, so the leading emoji (`💡` / `⚠️`) and the bold header are what give the terminal its at-a-glance cue — keep both. Don't replace the callout with an inline-code-wrapped frame; that renders as plain monospace text everywhere.

Rules:

- **2–3 bullets max** per block. Each bullet one line, occasionally two. Aggressively cut.
- **Pick the right type.** A non-obvious choice is an `IMPORTANT` insight; a thing that bites is a `WARNING` caution. Don't reach for both when one fits.
- **Codebase- or change-specific.** Quote a `file:line`, name an actual symbol, point at a real trade-off in *this* repo. Skip generic programming knowledge — the user already knows what a closure is.
- **Inline, not at the end.** Drop them as you write the code, where they explain a choice you just made — not as a postscript summary.
- **Conversation only.** They go in the chat, never as comments in source files.
- **Skip on simple turns.** No callout blocks for one-shot factual questions, status checks, or pure conversation.
- **Skip when nothing's interesting.** A boring boilerplate change doesn't need one. Forced notes become noise.
