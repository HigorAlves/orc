# Clean Architecture — Reference

Uncle Bob's Clean Architecture: directory layout, the dependency rule, and a full core implementation. Referenced from SKILL.md.

---

## Core Concept

**Layers (dependency flows inward):**

- **Entities**: Core business models, no framework imports
- **Use Cases**: Application business rules, orchestrate entities
- **Interface Adapters**: Controllers, presenters, gateways — translate between use cases and external formats
- **Frameworks & Drivers**: UI, database, external services — all at the outermost ring

**Key Principles:**

- Dependencies point inward only; inner layers know nothing about outer layers
- Business logic is independent of frameworks, databases, and delivery mechanisms
- Every layer boundary is crossed via an abstract interface
- Testable without UI, database, or external services

---

## Directory Structure

```
app/
├── domain/           # Entities, value objects, interfaces
│   ├── entities/
│   │   ├── user.py
│   │   └── order.py
│   ├── value_objects/
│   │   ├── email.py
│   │   └── money.py
│   └── interfaces/   # Abstract ports (no implementations)
│       ├── user_repository.py
│       └── payment_gateway.py
├── use_cases/        # Application business rules
│   ├── create_user.py
│   ├── process_order.py
│   └── send_notification.py
├── adapters/         # Concrete implementations
│   ├── repositories/
│   │   ├── postgres_user_repository.py
│   │   └── redis_cache_repository.py
│   ├── controllers/
│   │   └── user_controller.py
│   └── gateways/
│       ├── stripe_payment_gateway.py
│       └── sendgrid_email_gateway.py
└── infrastructure/   # Framework wiring, config, DI container
    ├── database.py
    ├── config.py
    └── logging.py
```

**Dependency rule in one sentence:** every `import` statement in `domain/` and `use_cases/` must point only toward `domain/`; nothing in those layers may import from `adapters/` or `infrastructure/`.

---

## Core Implementation

```python
# domain/entities/user.py
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    """Core user entity — no framework dependencies."""
    id: str
    email: str
    name: str
    created_at: datetime
    is_active: bool = True

    def deactivate(self):
        self.is_active = False

    def can_place_order(self) -> bool:
        return self.is_active


# domain/interfaces/user_repository.py
from abc import ABC, abstractmethod
from typing import Optional
from domain.entities.user import User

class IUserRepository(ABC):
    """Port: defines contract, no implementation details."""

    @abstractmethod
    async def find_by_id(self, user_id: str) -> Optional[User]: ...

    @abstractmethod
    async def find_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    async def save(self, user: User) -> User: ...

    @abstractmethod
    async def delete(self, user_id: str) -> bool: ...


# use_cases/create_user.py
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import uuid
from domain.entities.user import User
from domain.interfaces.user_repository import IUserRepository

@dataclass
class CreateUserRequest:
    email: str
    name: str

@dataclass
class CreateUserResponse:
    user: Optional[User]
    success: bool
    error: Optional[str] = None

class CreateUserUseCase:
    """Use case: orchestrates business logic, no HTTP or DB details."""

    def __init__(self, user_repository: IUserRepository):
        self.user_repository = user_repository

    async def execute(self, request: CreateUserRequest) -> CreateUserResponse:
        existing = await self.user_repository.find_by_email(request.email)
        if existing:
            return CreateUserResponse(user=None, success=False, error="Email already exists")

        user = User(
            id=str(uuid.uuid4()),
            email=request.email,
            name=request.name,
            created_at=datetime.now(),
        )
        saved_user = await self.user_repository.save(user)
        return CreateUserResponse(user=saved_user, success=True)


# adapters/repositories/postgres_user_repository.py
from domain.interfaces.user_repository import IUserRepository
from domain.entities.user import User
from typing import Optional
import asyncpg

class PostgresUserRepository(IUserRepository):
    """Adapter: PostgreSQL implementation of the user port."""

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def find_by_id(self, user_id: str) -> Optional[User]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
            return self._to_entity(row) if row else None

    async def find_by_email(self, email: str) -> Optional[User]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE email = $1", email)
            return self._to_entity(row) if row else None

    async def save(self, user: User) -> User:
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (id, email, name, created_at, is_active)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE
                SET email = $2, name = $3, is_active = $5
                """,
                user.id, user.email, user.name, user.created_at, user.is_active,
            )
        return user

    async def delete(self, user_id: str) -> bool:
        async with self.pool.acquire() as conn:
            result = await conn.execute("DELETE FROM users WHERE id = $1", user_id)
            return result == "DELETE 1"

    def _to_entity(self, row) -> User:
        return User(
            id=row["id"], email=row["email"], name=row["name"],
            created_at=row["created_at"], is_active=row["is_active"],
        )


# adapters/controllers/user_controller.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from use_cases.create_user import CreateUserUseCase, CreateUserRequest

router = APIRouter()

class CreateUserDTO(BaseModel):
    email: str
    name: str

@router.post("/users")
async def create_user(
    dto: CreateUserDTO,
    use_case: CreateUserUseCase = Depends(get_create_user_use_case),
):
    """Controller handles HTTP only — no business logic lives here."""
    response = await use_case.execute(CreateUserRequest(email=dto.email, name=dto.name))
    if not response.success:
        raise HTTPException(status_code=400, detail=response.error)
    return {"user": response.user}
```

---

## Testing — In-Memory Adapters

The hallmark of correctly applied Clean Architecture is that every use case can be exercised in a plain unit test with no real database, no Docker, and no network:

```python
# tests/unit/test_create_user.py
import asyncio
from typing import Dict, Optional
from domain.entities.user import User
from domain.interfaces.user_repository import IUserRepository
from use_cases.create_user import CreateUserUseCase, CreateUserRequest


class InMemoryUserRepository(IUserRepository):
    def __init__(self):
        self._store: Dict[str, User] = {}

    async def find_by_id(self, user_id: str) -> Optional[User]:
        return self._store.get(user_id)

    async def find_by_email(self, email: str) -> Optional[User]:
        return next((u for u in self._store.values() if u.email == email), None)

    async def save(self, user: User) -> User:
        self._store[user.id] = user
        return user

    async def delete(self, user_id: str) -> bool:
        return self._store.pop(user_id, None) is not None


async def test_create_user_succeeds():
    repo = InMemoryUserRepository()
    use_case = CreateUserUseCase(user_repository=repo)

    response = await use_case.execute(CreateUserRequest(email="alice@example.com", name="Alice"))

    assert response.success
    assert response.user.email == "alice@example.com"
    assert response.user.id is not None


async def test_duplicate_email_rejected():
    repo = InMemoryUserRepository()
    use_case = CreateUserUseCase(user_repository=repo)

    await use_case.execute(CreateUserRequest(email="alice@example.com", name="Alice"))
    response = await use_case.execute(CreateUserRequest(email="alice@example.com", name="Alice2"))

    assert not response.success
    assert "already exists" in response.error
```

See `dependency-rules.md` for the dependency-injection wiring that swaps `PostgresUserRepository` for `InMemoryUserRepository` in tests with no other code changes.
