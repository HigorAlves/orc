---
name: architecture-patterns
description: Implement Clean, Hexagonal (Ports & Adapters), and Domain-Driven architecture patterns. Use when designing service layers, refactoring monoliths into bounded contexts, or fixing layer dependency cycles.
---

# Architecture Patterns

Master proven backend architecture patterns — Clean Architecture, Hexagonal (Ports & Adapters), and Domain-Driven Design — to build maintainable, testable, scalable systems.

**Given:** a service boundary or module to architect.
**Produces:** layered structure with clear dependency rules, interface definitions, and test boundaries.

## When to Use This Skill

- Designing new backend services or microservices from scratch
- Refactoring monolithic applications where business logic is entangled with ORM models or HTTP concerns
- Establishing bounded contexts before splitting a system into services
- Debugging dependency cycles where infrastructure code bleeds into the domain layer
- Creating testable codebases where use-case tests do not require a running database
- Implementing DDD tactical patterns (aggregates, value objects, domain events)

## Choosing a Pattern

| If you are… | Reach for | Read |
|---|---|---|
| Laying out a fresh service into layers with an inward dependency rule | Clean Architecture | `references/clean-architecture.md` |
| Wanting to swap infra (DB, payment gateway) without touching business logic | Hexagonal (Ports & Adapters) | `references/hexagonal.md` |
| Modelling a complex domain — aggregates, value objects, invariants, events | Domain-Driven Design | `references/ddd.md` |
| Splitting one model into multiple bounded contexts / multi-service trees | DDD strategic + ACL | `references/advanced-patterns.md` |
| Fighting circular imports, leaky entities, or "all logic in the controller" | Dependency rules + fixes | `references/dependency-rules.md` |

The three patterns are complementary, not exclusive: Clean Architecture gives the layering, Hexagonal names the boundary interfaces (ports/adapters), and DDD fills the inner layers with rich domain models. A typical service uses all three.

## Reference Index

Read the relevant `references/<topic>.md` file on demand when you need that detail — do not load them all up front.

| Topic | File | Contents |
|---|---|---|
| Clean Architecture | `references/clean-architecture.md` | Layer model, directory structure, the dependency rule, full entity → use case → repository → controller implementation, in-memory test adapters |
| Hexagonal Architecture | `references/hexagonal.md` | Domain core + ports + production/test adapters, Onion vs. Clean comparison, domain services |
| Domain-Driven Design | `references/ddd.md` | Strategic + tactical patterns, value objects, aggregate roots, repositories, domain events / transactional outbox, aggregate-design heuristics |
| Advanced / multi-service | `references/advanced-patterns.md` | Multi-service project tree by bounded context, Anti-Corruption Layer, context map (Open Host / Shared Kernel / Conformist) |
| Dependency rules & fixes | `references/dependency-rules.md` | Troubleshooting symptoms, DI container wiring, detecting & breaking dependency cycles |

## Related Skills

- `microservices-patterns` — Apply these architecture patterns when decomposing a monolith into services
- `cqrs-implementation` — Use Clean Architecture as the structural foundation for CQRS command/query separation
- `saga-orchestration` — Sagas require well-defined aggregate boundaries, which DDD tactical patterns provide
- `event-store-design` — Domain events produced by aggregates feed directly into an event store
