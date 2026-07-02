---
name: insights
description: The orc callout palette — GitHub-flavored callouts for insights and cautions while writing code, plus the Gate/Preview/Danger/Hint blocks every orc command uses for must-not-miss output. Use when about to add an insight, caution, gate, preview, or danger block to the conversation.
---

# insights

When writing or modifying code, surface brief educational notes about non-obvious choices — in the surrounding codebase or in the change itself. This skill is also the canonical home of the **orc callout palette**: every must-not-miss block an orc command emits (gates, previews, destructive confirms) uses one of the shapes below.

## How these render (as of Claude Code 2.1.x, verified against v2.1.185)

They're GitHub-flavored callouts: on GitHub and in editors like VS Code they render as colored admonitions. The Claude Code terminal does **not** parse the alert type — the block degrades to a styled single-color blockquote with the tag visible as text, so the leading emoji in the header is what carries the per-type color cue in the TUI. The `> [!TYPE]` prefix is load-bearing for rich renderers; the emoji + bold header is load-bearing for the terminal — keep both.

**Flip condition:** when a Claude Code release themes alert types natively in the terminal, drop the emoji from the headers in this file (and the pointer in `using-orc`) — every other file copies these templates mechanically.

## The palette

One shape for every block:

```
> [!TYPE]
> **<emoji> <Title>**
>
> <1–3 short lines or bullets>
```

| Purpose | Alert | Header | Use for |
|---|---|---|---|
| Insight | `[!IMPORTANT]` | `**💡 Insight**` | non-obvious choice, trade-off, thing worth knowing |
| Caution | `[!WARNING]` | `**⚠️ Caution**` (variants `**⚠️ Caution — <what>**`, `**⚠️ Skipped — <reason>**`) | gotchas, footguns, skip-with-warning, non-blocking anomalies |
| Danger | `[!CAUTION]` | `**🛑 <what>**` | destructive previews, discard confirms, escalations, blocked states |
| Gate | `[!NOTE]` — `[!WARNING]` when fired by a problem | `**⛔ Gate — <name>**` | 1–3 context lines immediately before an `AskUserQuestion` |
| Preview | `[!NOTE]` | `**📋 Preview — <action>**` | headline over an about-to-act payload |
| Hint | `[!TIP]` | `**➡️ Next**` | final handoff line only; sparingly |

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

**Danger** — about to destroy something, or hard-blocked. Use `> [!CAUTION]`:

```
> [!CAUTION]
> **🛑 Destructive — confirm to proceed**
>
> - [what will be removed / why we're blocked]
```

**Gate** — context immediately before an `AskUserQuestion`. Options never go in the callout — the question widget renders them natively:

```
> [!NOTE]
> **⛔ Gate — <name>**
>
> [1–3 lines: what's being decided and why it fired]
```

**Preview** — headline over a payload the next action will use (review to post, cleanup plan, stack plan):

```
> [!NOTE]
> **📋 Preview — <action>**
```

followed by the payload in a fenced block, never inside the callout.

## Rules

- **Header line mandatory.** Blank `>` line between header and body; body ≤3 bullets/lines. Aggressively cut.
- **Tabular or monospace payload never goes inside a callout** — blockquotes reflow and break alignment. Keep fenced blocks immediately *after* the callout headline.
- **Never stack two callouts back-to-back.** One block, or callout + fence.
- **Must-not-miss blocks only.** One-line `✓` echoes, progress lines, and report `##` sections stay plain. Forced callouts become noise.
- **Pick the right type.** A non-obvious choice is an `IMPORTANT` insight; a thing that bites is a `WARNING` caution; a thing that deletes is a `CAUTION` danger.
- **Codebase- or change-specific** (insights/cautions). Quote a `file:line`, name an actual symbol, point at a real trade-off in *this* repo. Skip generic programming knowledge.
- **Inline, not at the end** (insights/cautions). Drop them as you write the code, where they explain a choice you just made.
- **Conversation only.** They go in the chat, never as comments in source files. JSON output contracts, GitHub-destined PR/comment bodies, and committed doc templates are exempt from the palette — they're parsed or rendered elsewhere.
- **Skip on simple turns.** No callout blocks for one-shot factual questions, status checks, or pure conversation.
