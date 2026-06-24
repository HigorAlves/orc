# Domain-Driven Design (DDD) — Reference

Strategic + tactical DDD: bounded contexts, value objects, aggregates, repositories, domain events, and aggregate-design heuristics. Referenced from SKILL.md.

---

## Core Concept

**Strategic Patterns:**

- **Bounded Contexts**: Isolate a coherent model for one subdomain; avoid sharing a single model across the whole system
- **Context Mapping**: Define how contexts relate (Anti-Corruption Layer, Shared Kernel, Open Host Service)
- **Ubiquitous Language**: Every term in code matches the term used by domain experts

**Tactical Patterns:**

- **Entities**: Objects with stable identity that change over time
- **Value Objects**: Immutable objects identified by their attributes (Email, Money, Address)
- **Aggregates**: Consistency boundaries; only the root is accessible from outside
- **Repositories**: Persist and reconstitute aggregates; abstract over the storage mechanism
- **Domain Events**: Capture things that happened inside the domain; used for cross-aggregate coordination

---

## Value Objects and Aggregates

```python
# Value Objects: immutable, validated at construction
from dataclasses import dataclass

@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self):
        if "@" not in self.value or "." not in self.value.split("@")[-1]:
            raise ValueError(f"Invalid email: {self.value}")

@dataclass(frozen=True)
class Money:
    amount: int   # cents
    currency: str

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("Money amount cannot be negative")
        if self.currency not in {"USD", "EUR", "GBP"}:
            raise ValueError(f"Unsupported currency: {self.currency}")

    def add(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError("Currency mismatch")
        return Money(self.amount + other.amount, self.currency)


# Aggregate root: enforces all invariants for its cluster of entities
class Order:
    def __init__(self, id: str, customer_id: str):
        self.id = id
        self.customer_id = customer_id
        self.items: list[OrderItem] = []
        self.status = OrderStatus.PENDING
        self._events: list[DomainEvent] = []

    def add_item(self, product: Product, quantity: int):
        if self.status != OrderStatus.PENDING:
            raise ValueError("Cannot modify a submitted order")
        item = OrderItem(product=product, quantity=quantity)
        self.items.append(item)
        self._events.append(ItemAddedEvent(order_id=self.id, item=item))

    @property
    def total(self) -> Money:
        totals = [item.subtotal() for item in self.items]
        return sum(totals[1:], totals[0]) if totals else Money(0, "USD")

    def submit(self):
        if not self.items:
            raise ValueError("Cannot submit an empty order")
        if self.status != OrderStatus.PENDING:
            raise ValueError("Order already submitted")
        self.status = OrderStatus.SUBMITTED
        self._events.append(OrderSubmittedEvent(order_id=self.id))

    def pop_events(self) -> list[DomainEvent]:
        events, self._events = self._events, []
        return events


# Repository: persist and reconstitute aggregates
class OrderRepository(ABC):
    @abstractmethod
    async def find_by_id(self, order_id: str) -> Optional[Order]: ...

    @abstractmethod
    async def save(self, order: Order) -> None: ...
    # Implementations persist events via pop_events() after writing state
```

---

## Aggregate Design Heuristics

Use these rules when deciding aggregate boundaries:

| Question | Guidance |
|---|---|
| Should these two objects always be consistent together? | Put them in the same aggregate. |
| Can they be eventually consistent? | Put them in separate aggregates; use domain events to sync. |
| Is one object the "owner" that controls access? | That object is the aggregate root. |
| Does removing the root make the child meaningless? | Child belongs inside the aggregate. |
| Are you loading thousands of objects to change one? | Aggregate is too large — split it. |

**Practical example — Order vs. Customer:**

```python
# Bad: Customer aggregate holds full Order objects
class Customer:
    def __init__(self):
        self._orders: list[Order] = []   # loads all orders every time

# Good: Customer holds Order IDs only; Order is its own aggregate
class Customer:
    def __init__(self):
        self._order_ids: list[str] = []  # lightweight reference

class Order:
    def __init__(self, id: str, customer_id: str):
        self.id = id
        self.customer_id = customer_id   # reference back, not the full object
```

---

## Domain Events — Publishing and Handling

Domain events decouple aggregates that need to react to each other's state changes:

```python
# domain/events/order_events.py
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class DomainEvent:
    occurred_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class OrderSubmittedEvent(DomainEvent):
    order_id: str = ""
    customer_id: str = ""
    total_cents: int = 0
    currency: str = "USD"


# adapters/event_publisher/postgres_outbox.py
# Transactional outbox pattern: write events to the same DB transaction as state
import json

class PostgresOutboxPublisher:
    """
    Writes domain events to an outbox table in the same transaction
    as the aggregate state. A separate relay process reads and publishes
    to the message broker. Guarantees at-least-once delivery.
    """

    async def publish(self, conn, events: list[DomainEvent]):
        for event in events:
            await conn.execute(
                """
                INSERT INTO outbox (event_type, payload, published_at)
                VALUES ($1, $2, NULL)
                """,
                type(event).__name__,
                json.dumps(event.__dict__, default=str),
            )


# use_cases/place_order.py — aggregate saves, events are extracted and stored
class PlaceOrderUseCase:
    def __init__(self, order_repo: OrderRepository, event_publisher: PostgresOutboxPublisher):
        self.orders = order_repo
        self.publisher = event_publisher

    async def execute(self, request: PlaceOrderRequest) -> PlaceOrderResponse:
        order = Order(id=str(uuid.uuid4()), customer_id=request.customer_id)
        for item in request.items:
            order.add_item(product=item.product, quantity=item.quantity)
        order.submit()

        async with self.db.transaction() as conn:
            await self.orders.save(order, conn)
            await self.publisher.publish(conn, order.pop_events())

        return PlaceOrderResponse(order_id=order.id, success=True)
```

---

## Bounded Contexts, Context Mapping, and the ACL

For full multi-service project trees organised by bounded context, the Anti-Corruption Layer (ACL) implementation, and the context map showing relationship types (Open Host Service, Shared Kernel, Conformist), see `advanced-patterns.md`.
