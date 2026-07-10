---
name: insights
description: The orc callout palette — emoji-header blockquotes for insights, cautions, gates, previews, and danger blocks in conversation, plus the GitHub-flavored [!TYPE] form for GitHub-bound output. Use when about to add an insight, caution, gate, preview, or danger block to the conversation or to a PR/doc.
---

# insights

When writing or modifying code, surface brief educational notes about non-obvious choices — in the surrounding codebase or in the change itself. This skill is also the canonical home of the **orc callout palette**: every must-not-miss block an orc command emits (gates, previews, destructive confirms) uses one of the shapes below.

## The destination rule (which form to emit)

The palette has **two forms**; pick by where the text will be read:

- **Terminal form (default — anything printed into the conversation):** blockquote + emoji bold header, **no `[!TYPE]` tag**. The Claude Code TUI doesn't parse GitHub alert types — a tag line just prints as literal junk text. The emoji carries the color cue.
- **GitHub form (GitHub-bound output only — PR bodies, issue/review comments, committed doc files):** the same block with a `> [!TYPE]` first line. GitHub and editors like VS Code render it as a colored admonition.

If unsure, ask "will this land in a file or on GitHub?" — no → terminal form.

**Flip condition:** when a Claude Code release themes GitHub alert types natively in the terminal, converge both forms on the GitHub one (and drop this rule) — every other file copies these templates mechanically.

## The palette

One shape for every conversation block:

```
> **<emoji> <Title>**
>
> <1–3 short lines or bullets>
```

| Purpose | Header | GitHub-form tag | Use for |
|---|---|---|---|
| Insight | `**💡 Insight**` | `[!IMPORTANT]` | non-obvious choice, trade-off, thing worth knowing |
| Caution | `**⚠️ Caution**` (variants `**⚠️ Caution — <what>**`, `**⚠️ Skipped — <reason>**`) | `[!WARNING]` | gotchas, footguns, skip-with-warning, non-blocking anomalies |
| Danger | `**🛑 <what>**` | `[!CAUTION]` | destructive previews, discard confirms, escalations, blocked states |
| Gate | `**⛔ Gate — <name>**` | `[!NOTE]` (`[!WARNING]` when fired by a problem) | 1–3 context lines immediately before an `AskUserQuestion` |
| Preview | `**📋 Preview — <action>**` | `[!NOTE]` | headline over an about-to-act payload |
| Hint | `**➡️ Next**` | `[!TIP]` | final handoff line only; sparingly |

**Insight** — a non-obvious choice, trade-off, or thing worth knowing:

```
> **💡 Insight**
>
> - [point 1, codebase-specific]
> - [point 2]
> - [optional point 3]
```

**Caution** — a gotcha, footgun, or risky thing the reader could trip on:

```
> **⚠️ Caution**
>
> - [gotcha / risky thing]
> - [optional point 2]
```

**Danger** — about to destroy something, or hard-blocked:

```
> **🛑 Destructive — confirm to proceed**
>
> - [what will be removed / why we're blocked]
```

**Gate** — context immediately before an `AskUserQuestion`. Options never go in the callout — the question widget renders them natively:

```
> **⛔ Gate — <name>**
>
> [1–3 lines: what's being decided and why it fired]
```

**Preview** — headline over a payload the next action will use (review to post, cleanup plan, stack plan):

```
> **📋 Preview — <action>**
```

followed by the payload in a fenced block, never inside the callout.

**GitHub form** — same block, tag line first. Example for an insight inside a PR body or committed doc:

```
> [!IMPORTANT]
> **💡 Insight**
>
> - [point]
```

## Rules

- **Header line mandatory.** Blank `>` line between header and body; body ≤3 bullets/lines. Aggressively cut.
- **Tabular or monospace payload never goes inside a callout** — blockquotes reflow and break alignment. Keep fenced blocks immediately *after* the callout headline.
- **Never stack two callouts back-to-back.** One block, or callout + fence.
- **Must-not-miss blocks only.** One-line `✓` echoes, progress lines, and report `##` sections stay plain. Forced callouts become noise.
- **Pick the right type.** A non-obvious choice is an Insight; a thing that bites is a Caution; a thing that deletes is a Danger.
- **Codebase- or change-specific** (insights/cautions). Quote a `file:line`, name an actual symbol, point at a real trade-off in *this* repo. Skip generic programming knowledge.
- **Inline, not at the end** (insights/cautions). Drop them as you write the code, where they explain a choice you just made.
- **Never as comments in source files.** Insights go in the chat (terminal form) or in PR/doc prose (GitHub form). JSON output contracts are exempt from the palette entirely — they're parsed, not read.
- **Skip on simple turns.** No callout blocks for one-shot factual questions, status checks, or pure conversation.
