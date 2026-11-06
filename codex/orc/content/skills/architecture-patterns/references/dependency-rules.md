# Dependency Rules & Troubleshooting — Reference

How to keep dependencies pointing inward, wire them with DI, and fix the common ways layered architectures break down. Referenced from SKILL.md.

---

## Troubleshooting Symptoms

### Use case tests require a running database

Business logic has leaked into the infrastructure layer. Move all database calls behind an `IRepository` interface and inject an in-memory implementation in tests (see `clean-architecture.md` → Testing). The use case constructor must accept the abstract port, not the concrete class.

### Circular imports between layers

A common symptom is `ImportError: cannot import name X` between `use_cases` and `adapters`. This happens when a use case imports a concrete adapter class instead of the abstract port. Enforce the rule: `use_cases/` imports only from `domain/` (entities and interfaces). It must never import from `adapters/` or `infrastructure/`.

### Framework decorators appearing in domain entities

If SQLAlchemy `Column()` or Pydantic `Field()` annotations appear on domain entities, the entity is no longer pure. Create a separate ORM model in `adapters/repositories/` and map to/from the domain entity in the repository's `_to_entity()` method.

### All logic ending up in controllers

When the controller grows beyond HTTP parsing and response formatting, extract the logic into a use case class. A controller method should do three things only: parse the request, call a use case, map the response.

### Value objects raising errors too late

Validate invariants in `__post_init__` (Python) or the constructor so an invalid `Email` or `Money` cannot be constructed at all. This surfaces bad data at the boundary, not deep inside business logic.

### Context bleed across bounded contexts

If the `Order` context is importing `User` entities from the `Identity` context, introduce an Anti-Corruption Layer. The `Order` context should hold its own lightweight `CustomerId` value object and only call the `Identity` context through an explicit interface. See `advanced-patterns.md` for the full ACL implementation.

---

## Dependency Injection Wiring — Infrastructure Layer

All the abstract interfaces are wired to concrete implementations in the infrastructure layer (or a DI container). Nothing else in the codebase knows which concrete class is used:

```python
# infrastructure/container.py
from functools import lru_cache
import asyncpg
from adapters.repositories.postgres_user_repository import PostgresUserRepository
from adapters.gateways.stripe_payment_gateway import StripePaymentAdapter
from use_cases.create_user import CreateUserUseCase
from infrastructure.config import Settings

@lru_cache
def get_settings() -> Settings:
    return Settings()

async def get_db_pool() -> asyncpg.Pool:
    settings = get_settings()
    return await asyncpg.create_pool(settings.database_url)

async def get_create_user_use_case() -> CreateUserUseCase:
    pool = await get_db_pool()
    repo = PostgresUserRepository(pool=pool)
    return CreateUserUseCase(user_repository=repo)

# In tests, replace get_create_user_use_case with a version
# that injects InMemoryUserRepository — no other code changes needed.
```

---

## Detecting and Breaking Dependency Cycles

Common symptoms and their structural fixes:

```
Symptom: use_cases/create_order.py imports from adapters/email_sender.py
Fix:     Create domain/interfaces/notification_service.py (abstract port).
         use_cases imports the port. adapters implements it.
         DI container wires them together.

Symptom: domain/entities/user.py imports from infrastructure/config.py
Fix:     Pass config values as constructor arguments or environment at
         the infrastructure boundary. Domain entities must not read config.

Symptom: Two aggregates import each other
Fix:     Introduce a domain event. Aggregate A emits OrderPlaced.
         Aggregate B's use case subscribes and reacts. They never import
         each other.

Symptom: Repository imports a use case to "do extra work" after saving
Fix:     Extract the extra work into a separate domain service or use case.
         Repositories persist state only; they do not orchestrate behaviour.
```

Visual dependency check — run this and look for any arrow pointing outward:

```bash
# Install: pip install pydeps
pydeps app --max-bacon=4 --cluster --rankdir=BT
# Expected: domain has no outgoing edges to adapters or infrastructure
```
