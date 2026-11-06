# Advanced Architecture Patterns — Reference

Deep-dive examples for DDD bounded contexts, Anti-Corruption Layers, and full multi-service project structures. Referenced from SKILL.md and from `ddd.md`. (Onion vs. Clean lives in `hexagonal.md`; DI wiring, aggregate heuristics, domain events, and cycle-breaking live in `dependency-rules.md` and `ddd.md`.)

---

## Full Multi-Service Project Structure

A realistic e-commerce system organised by bounded context, each context is a deployable service:

```
ecommerce/
├── services/
│   ├── identity/                    # Bounded context: users & auth
│   │   ├── identity/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.py
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── email.py
│   │   │   │   │   └── password_hash.py
│   │   │   │   └── interfaces/
│   │   │   │       └── user_repository.py
│   │   │   ├── use_cases/
│   │   │   │   ├── register_user.py
│   │   │   │   └── authenticate_user.py
│   │   │   ├── adapters/
│   │   │   │   ├── repositories/
│   │   │   │   │   └── postgres_user_repository.py
│   │   │   │   └── controllers/
│   │   │   │       └── auth_controller.py
│   │   │   └── infrastructure/
│   │   │       └── jwt_service.py
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
│   │
│   ├── catalog/                     # Bounded context: products
│   │   ├── catalog/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── product.py
│   │   │   │   └── value_objects/
│   │   │   │       ├── sku.py
│   │   │   │       └── price.py
│   │   │   └── use_cases/
│   │   │       ├── create_product.py
│   │   │       └── update_inventory.py
│   │   └── tests/
│   │
│   └── ordering/                    # Bounded context: orders
│       ├── ordering/
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   │   └── order.py
│       │   │   ├── value_objects/
│       │   │   │   ├── customer_id.py   # NOT imported from identity!
│       │   │   │   └── money.py
│       │   │   └── interfaces/
│       │   │       ├── order_repository.py
│       │   │       └── catalog_client.py  # ACL port to catalog context
│       │   ├── use_cases/
│       │   │   ├── place_order.py
│       │   │   └── cancel_order.py
│       │   └── adapters/
│       │       ├── acl/
│       │       │   └── catalog_http_client.py  # ACL adapter
│       │       └── repositories/
│       │           └── postgres_order_repository.py
│       └── tests/
│
├── shared/                          # Shared kernel (use sparingly)
│   └── domain_events/
│       └── base_event.py
└── docker-compose.yml
```

---

## Anti-Corruption Layer (ACL)

When the `Ordering` context must fetch product data from the `Catalog` context, it should never use `Catalog`'s domain model directly. An ACL translates between the two models:

```python
# ordering/domain/interfaces/catalog_client.py
from abc import ABC, abstractmethod
from ordering.domain.value_objects.product_snapshot import ProductSnapshot

class CatalogClientPort(ABC):
    """
    Ordering's view of product data. Uses Ordering's own value object,
    not Catalog's Product entity.
    """

    @abstractmethod
    async def get_product_snapshot(self, sku: str) -> ProductSnapshot: ...


# ordering/domain/value_objects/product_snapshot.py
from dataclasses import dataclass
from ordering.domain.value_objects.money import Money

@dataclass(frozen=True)
class ProductSnapshot:
    """Ordering's local representation of a product at order time."""
    sku: str
    name: str
    unit_price: Money
    available: bool


# ordering/adapters/acl/catalog_http_client.py
import httpx
from ordering.domain.interfaces.catalog_client import CatalogClientPort
from ordering.domain.value_objects.product_snapshot import ProductSnapshot
from ordering.domain.value_objects.money import Money

class CatalogHttpClient(CatalogClientPort):
    """
    ACL adapter: calls Catalog's HTTP API and translates
    Catalog's response schema into Ordering's ProductSnapshot.
    """

    def __init__(self, base_url: str, http_client: httpx.AsyncClient):
        self._base_url = base_url
        self._http = http_client

    async def get_product_snapshot(self, sku: str) -> ProductSnapshot:
        response = await self._http.get(f"{self._base_url}/products/{sku}")
        response.raise_for_status()
        data = response.json()

        # Translation: Catalog speaks "price_cents" + "currency_code";
        # Ordering speaks Money(amount, currency).
        return ProductSnapshot(
            sku=data["sku"],
            name=data["title"],              # field name differs between contexts
            unit_price=Money(
                amount=data["price_cents"],
                currency=data["currency_code"],
            ),
            available=data["stock_count"] > 0,
        )


# Test ACL with a stub — no HTTP required
class StubCatalogClient(CatalogClientPort):
    def __init__(self, products: dict[str, ProductSnapshot]):
        self._products = products

    async def get_product_snapshot(self, sku: str) -> ProductSnapshot:
        if sku not in self._products:
            raise ValueError(f"Unknown SKU: {sku}")
        return self._products[sku]
```

---

## Context Map — Relationships Between Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────┐
│                        E-Commerce System                         │
│                                                                  │
│   ┌─────────────┐   Open Host   ┌─────────────────────────┐    │
│   │  Identity   │──────────────▶│        Ordering          │    │
│   │  Context    │               │  (uses CustomerId VO,    │    │
│   │             │               │   not User entity)       │    │
│   └─────────────┘               └─────────────────────────┘    │
│                                          │ ACL                   │
│                                          ▼                       │
│                                 ┌─────────────────┐             │
│   ┌─────────────┐  Shared       │    Catalog      │             │
│   │  Payments   │  Kernel       │    Context      │             │
│   │  Context    │◀─────────────▶│                 │             │
│   │             │  (Money VO)   └─────────────────┘             │
│   └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘

Relationship types:
  Open Host Service  — upstream provides a stable API for many downstream contexts
  ACL (Anti-Corruption Layer) — downstream translates upstream model to its own
  Shared Kernel     — two contexts share a small, explicitly governed sub-model
  Conformist        — downstream adopts upstream model as-is (last resort)
```
