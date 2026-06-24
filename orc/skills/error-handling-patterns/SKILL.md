---
name: error-handling-patterns
description: Error handling patterns across languages — exceptions, Result types, propagation, graceful degradation. Use when implementing error handling, designing APIs, or improving reliability.
---

# Error Handling Patterns

Build resilient applications with robust error handling strategies that gracefully handle failures and provide excellent debugging experiences.

This SKILL.md is a thin index. **Read the relevant `references/<topic>.md` file** only when you need that topic's detail — the code samples and full patterns live there, not here.

## When to Use This Skill

- Implementing error handling in new features
- Designing error-resilient APIs
- Debugging production issues
- Improving application reliability
- Creating better error messages for users and developers
- Implementing retry and circuit breaker patterns
- Handling async/concurrent errors
- Building fault-tolerant distributed systems

## Core Concepts

**Error handling philosophies:**

- **Exceptions** — traditional try-catch, disrupts control flow.
- **Result types** — explicit success/failure, functional approach.
- **Error codes** — C-style, requires discipline.
- **Option/Maybe types** — for nullable values.

**Error categories:**

- **Recoverable** — network timeouts, missing files, invalid user input, API rate limits. Handle and continue (retry, fallback).
- **Unrecoverable** — out of memory, stack overflow, programming bugs (null pointer). Fail loudly / crash.

## Decision Tree — which strategy?

```
Is the failure expected as part of normal operation
(validation, parse, lookup miss, rate limit)?
├── YES → Return a Result / Option type.            → references/result-types.md
│         Caller must explicitly handle the failure.
└── NO  → Is it a programming bug or truly unrecoverable
          (OOM, invariant violation)?
          ├── YES → Panic / crash. Don't try to recover.
          └── NO  → It's an unexpected-but-recoverable error
                    → Throw an exception.               → references/exceptions.md

Then, regardless of strategy:
- Does the error cross layers / async boundaries, or do you
  need to collect several before surfacing?      → references/propagation.md
- Is this a flaky external / distributed dependency you must
  keep serving through (retry, circuit breaker, fallback)?
                                                  → references/graceful-degradation.md
- Need the language-native idiom or full type defs?
                                                  → references/language-specific.md
- Unsure about messaging, logging, or cleanup hygiene?
                                                  → references/best-practices.md
```

## Topic Index

| Topic | Read when you need… | Reference |
|-------|--------------------|-----------|
| Exceptions | Custom exception hierarchies, throwing, try-except/catch structure, context-manager cleanup, the full comprehensive handler example | `references/exceptions.md` |
| Result & Option types | Explicit `Result<T, E>` / `Option` values for expected errors and validation; helpers, chaining, consuming | `references/result-types.md` |
| Propagation | Re-throwing, wrapping/chaining for context (`%w`, `errors.Is`/`As`, `?`), async/promise propagation, error aggregation | `references/propagation.md` |
| Graceful degradation | Retry with backoff, circuit breaker, fallbacks/degraded mode for recoverable & distributed failures | `references/graceful-degradation.md` |
| Language-specific | Per-language idioms and full type scaffolding (Python, TypeScript/JavaScript, Rust, Go) | `references/language-specific.md` |
| Best practices & pitfalls | Cross-cutting rules (fail fast, preserve context, log appropriately) and anti-patterns to avoid | `references/best-practices.md` |
