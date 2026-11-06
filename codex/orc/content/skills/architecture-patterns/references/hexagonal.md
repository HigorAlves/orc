# Hexagonal Architecture (Ports and Adapters) — Reference

The domain core, its ports, and concrete/test adapters. Referenced from SKILL.md.

---

## Core Concept

**Components:**

- **Domain Core**: Business logic lives here, framework-free
- **Ports**: Abstract interfaces that define how the core interacts with the outside world (driving and driven)
- **Adapters**: Concrete implementations of ports (PostgreSQL adapter, Stripe adapter, REST adapter)

**Benefits:**

- Swap implementations without touching the core (e.g., replace PostgreSQL with DynamoDB)
- Use in-memory adapters in tests — no Docker required
- Technology decisions deferred to the edges

---

## Ports and Adapters — Implementation

```python
# Core domain service — no infrastructure dependencies
class OrderService:
    def __init__(
        self,
        order_repository: OrderRepositoryPort,
        payment_gateway: PaymentGatewayPort,
        notification_service: NotificationPort,
    ):
        self.orders = order_repository
        self.payments = payment_gateway
        self.notifications = notification_service

    async def place_order(self, order: Order) -> OrderResult:
        if not order.is_valid():
            return OrderResult(success=False, error="Invalid order")

        payment = await self.payments.charge(amount=order.total, customer=order.customer_id)
        if not payment.success:
            return OrderResult(success=False, error="Payment failed")

        order.mark_as_paid()
        saved_order = await self.orders.save(order)
        await self.notifications.send(
            to=order.customer_email,
            subject="Order confirmed",
            body=f"Order {order.id} confirmed",
        )
        return OrderResult(success=True, order=saved_order)


# Ports (driving and driven interfaces)
class OrderRepositoryPort(ABC):
    @abstractmethod
    async def save(self, order: Order) -> Order: ...

class PaymentGatewayPort(ABC):
    @abstractmethod
    async def charge(self, amount: Money, customer: str) -> PaymentResult: ...

class NotificationPort(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body: str): ...


# Production adapter: Stripe
class StripePaymentAdapter(PaymentGatewayPort):
    def __init__(self, api_key: str):
        import stripe
        stripe.api_key = api_key
        self._stripe = stripe

    async def charge(self, amount: Money, customer: str) -> PaymentResult:
        try:
            charge = self._stripe.Charge.create(
                amount=amount.cents, currency=amount.currency, customer=customer
            )
            return PaymentResult(success=True, transaction_id=charge.id)
        except self._stripe.error.CardError as e:
            return PaymentResult(success=False, error=str(e))


# Test adapter: no external dependencies
class MockPaymentAdapter(PaymentGatewayPort):
    async def charge(self, amount: Money, customer: str) -> PaymentResult:
        return PaymentResult(success=True, transaction_id="mock-txn-123")
```

---

## Onion Architecture vs. Clean Architecture

Both enforce inward-pointing dependencies. The difference is terminology and layering granularity:

| Concern | Clean Architecture | Onion Architecture |
|---|---|---|
| Innermost ring | Entities | Domain Model |
| Second ring | Use Cases | Domain Services |
| Third ring | Interface Adapters | Application Services |
| Outermost ring | Frameworks & Drivers | Infrastructure / UI / Tests |
| Key insight | Controller is an adapter | Application Services = Use Cases |

Onion Architecture makes the Domain Services layer explicit — it hosts pure domain logic that spans multiple entities but has no I/O:

```python
# onion/domain/services/pricing_service.py
from domain.entities.product import Product
from domain.value_objects.money import Money
from domain.value_objects.discount import Discount

class PricingService:
    """
    Domain service: logic that doesn't belong to a single entity.
    No ports or adapters here — purely domain computation.
    """

    def apply_bulk_discount(self, product: Product, quantity: int) -> Money:
        if quantity >= 100:
            discount = Discount(percentage=20)
        elif quantity >= 50:
            discount = Discount(percentage=10)
        else:
            discount = Discount(percentage=0)
        return product.price.apply_discount(discount)

    def calculate_order_total(self, items: list[tuple[Product, int]]) -> Money:
        subtotals = [self.apply_bulk_discount(p, q) for p, q in items]
        return sum(subtotals[1:], subtotals[0]) if subtotals else Money(0, "USD")
```
