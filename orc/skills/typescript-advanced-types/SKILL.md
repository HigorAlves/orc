---
name: typescript-advanced-types
description: Master TypeScript's advanced type system - generics, conditional, mapped, template-literal, utility types, inference, and type guards. Use for complex type logic, reusable type utilities, or compile-time type safety.
---

# TypeScript Advanced Types

Guidance for mastering TypeScript's advanced type system — generics, conditional types, mapped types, template literal types, utility types, inference, and type guards — for building robust, type-safe applications.

## When to Use This Skill

- Building type-safe libraries or frameworks
- Creating reusable generic components
- Implementing complex type inference logic
- Designing type-safe API clients
- Building form validation systems
- Creating strongly-typed configuration objects
- Implementing type-safe state management
- Migrating JavaScript codebases to TypeScript

## How to Use

This file is a thin index. Identify which topic the task needs from the decision tree below, then **Read the matching `references/<topic>.md` file** for the detailed patterns and code. Load only the references you need; for a broad task you may read several.

## Decision Tree

- Need a **reusable, type-flexible function/class/component** (type parameters, constraints, builders, event emitters)? → `references/generics.md`
- Need a type that **branches on a condition** (`T extends U ? X : Y`, distributive types, API client signatures)? → `references/conditional-types.md`
- Need to **transform an existing type's properties** (readonly/partial, key remapping, filtering, deep transforms, form validation shapes)? → `references/mapped-types.md`
- Need **string-based types** (event handler names, path strings, `Uppercase`/`Capitalize`)? → `references/template-literal-types.md`
- Need **built-in helpers** (`Partial`, `Pick`, `Omit`, `Record`, `Exclude`), **discriminated unions**, type testing, best practices, pitfalls, or performance notes? → `references/utility-types.md`
- Need to **extract/infer a type** from another (`infer` keyword, element/promise/parameter types)? → `references/inference.md`
- Need **runtime narrowing** (type guards, `value is T`, `asserts value is T`)? → `references/type-guards.md`

## Topic Reference Map

| Topic | Read this file | Covers |
|-------|----------------|--------|
| Generics | `references/generics.md` | Generic functions, constraints, multiple type params, typed event emitter, type-safe builder |
| Conditional types | `references/conditional-types.md` | Basic/nested/distributive conditionals, `infer` return types, type-safe API client |
| Mapped types | `references/mapped-types.md` | Readonly/partial/optional, key remapping, property filtering, deep readonly/partial, form validation |
| Template literal types | `references/template-literal-types.md` | Template literals, string manipulation, recursive path building |
| Utility types | `references/utility-types.md` | Built-in utilities, discriminated unions, type testing, best practices, pitfalls, performance |
| Inference | `references/inference.md` | `infer` keyword — element, promise, and parameter extraction |
| Type guards | `references/type-guards.md` | User-defined type guards and assertion functions |

## Best Practices (summary)

Use `unknown` over `any`; prefer `interface` for object shapes and `type` for unions; lean on inference; build reusable helper types; use const assertions; prefer type guards over assertions; enable strict mode; test your types. Full list with pitfalls and performance considerations lives in `references/utility-types.md`.
