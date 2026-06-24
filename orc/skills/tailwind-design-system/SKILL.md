---
name: tailwind-design-system
description: Build scalable Tailwind CSS v4 design systems — design tokens, component libraries, responsive patterns. Use for component libraries, design systems, or standardizing UI patterns.
---

# Tailwind Design System (v4)

Build production-ready design systems with Tailwind CSS v4: CSS-first configuration, design tokens, component variants, responsive patterns, accessibility, and a distinctive (non-generic) aesthetic.

> **Note**: This skill targets Tailwind CSS v4 (2024+). For v3 projects, refer to the [upgrade guide](https://tailwindcss.com/docs/upgrade-guide).

## When to Use This Skill

- Creating a component library with Tailwind v4
- Implementing design tokens and theming with CSS-first configuration
- Building responsive and accessible components
- Standardizing UI patterns across a codebase
- Migrating from Tailwind v3 to v4
- Setting up dark mode with native CSS features
- Designing interfaces that look intentionally crafted, not generic "AI slop"

## Key v4 Changes (at a glance)

| v3 Pattern                            | v4 Pattern                                          |
| ------------------------------------- | --------------------------------------------------- |
| `tailwind.config.ts`                  | `@theme` in CSS                                     |
| `@tailwind base/components/utilities` | `@import "tailwindcss"`                             |
| `darkMode: "class"`                   | `@custom-variant dark (&:where(.dark, .dark *))`    |
| `theme.extend.colors`                 | `@theme { --color-*: value }`                       |
| `require("tailwindcss-animate")`      | native `@keyframes` + `@starting-style`             |

Full migration checklist lives in [references/advanced-patterns.md](references/advanced-patterns.md).

## Core Concepts

- **Design token hierarchy** — Brand tokens → Semantic tokens → Component tokens. Reference tokens via utilities (`bg-primary`), never hardcode colors.
- **Component architecture** — Base styles → Variants → Sizes → States → Overrides. Use CVA for type-safe variants.
- **CSS-first config** — All theme configuration lives in `@theme` blocks in CSS, not a JS/TS config file.
- **OKLCH colors** — Prefer OKLCH for perceptual uniformity over HSL.
- **React 19** — `ref` is a regular prop; no `forwardRef`.

## Reference Topics

Read the topic file relevant to the task — each is self-contained with full copy-paste examples.

| Topic | File | Covers |
| ----- | ---- | ------ |
| **Design tokens & setup** | [references/design-tokens.md](references/design-tokens.md) | `@theme` quick-start, OKLCH semantic tokens, dark-mode variant + overrides, base styles, token hierarchy, `cn()` / `focusRing` / `disabled` utilities, v3→v4 change table |
| **Component patterns** | [references/components.md](references/components.md) | CVA button (Pattern 1), compound Card (Pattern 2), form Input/Label + React Hook Form + Zod (Pattern 3) |
| **Responsive patterns** | [references/responsive.md](references/responsive.md) | Responsive `Grid` + `Container` CVA components (Pattern 4) |
| **Advanced patterns** | [references/advanced-patterns.md](references/advanced-patterns.md) | Native CSS animations (Pattern 5), Dialog with Radix, dark-mode `ThemeProvider` + `ThemeToggle` (Pattern 6), custom `@utility`, theme modifiers (`@theme inline`/`static`), namespace overrides, `color-mix()` alpha variants, container queries, v3→v4 migration checklist, Do's & Don'ts |
| **Distinctive UI** | [references/distinctive-ui.md](references/distinctive-ui.md) | Avoiding generic AI aesthetics — design thinking, bold aesthetic direction, typography/color/motion/composition/background guidelines |

## Best Practices (summary)

**Do:** use `@theme` blocks; OKLCH colors; compose with CVA; semantic tokens (`bg-primary`); `size-*` shorthand; ARIA + focus states; commit to a distinctive, cohesive aesthetic.

**Don't:** use `tailwind.config.ts` or `@tailwind` directives; use `forwardRef`; use arbitrary values (extend `@theme` instead); hardcode colors; forget dark mode; converge on generic fonts/palettes (Inter, purple-on-white, etc.).

Full Do's & Don'ts and the migration checklist are in [references/advanced-patterns.md](references/advanced-patterns.md); aesthetic guidance is in [references/distinctive-ui.md](references/distinctive-ui.md).
