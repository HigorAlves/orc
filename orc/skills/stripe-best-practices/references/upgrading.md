# Upgrading API versions and SDKs

## Table of contents

- API versioning model
- Server-side SDKs
- Stripe.js
- Mobile SDKs
- Upgrade checklist
- Testing a new version safely

## API versioning model

Stripe uses date-based API versions (e.g., `2026-04-22.dahlia`, `2025-08-27.basil`, `2024-12-18.acacia`). The account's API version determines request/response behavior, and multiple versions coexist simultaneously — staged adoption is expected.

**Backward-compatible changes** (no code updates needed): new API resources, new optional request parameters, new response properties, changes to opaque string lengths (e.g., object IDs), new webhook event types.

**Breaking changes** (require code updates): field renames or removals, behavioral modifications, removed endpoints or parameters. Breaking changes are tagged by affected product area (Payments, Billing, Connect, etc.).

Review the [API Changelog](https://docs.stripe.com/changelog.md) for all changes between the current and target versions, and the [Upgrades Guide](https://docs.stripe.com/upgrades.md) for migration guidance.

## Server-side SDKs

See [SDK Version Management](https://docs.stripe.com/sdks/set-version.md).

**Dynamically-typed languages (Ruby, Python, PHP, Node.js)** support global configuration and per-request overrides:

```javascript
const stripe = require('stripe')('sk_test_xxx', {
  apiVersion: '2026-04-22.dahlia'
});
```

```python
import stripe
stripe.api_version = '2026-04-22.dahlia'
# per-request: stripe.Customer.create(..., stripe_version='2026-04-22.dahlia')
```

**Strongly-typed languages (Java, Go, .NET)** use a fixed API version matching the SDK release. Do not set a different API version — response objects might not match the SDK's strong types. Upgrade the SDK itself to target a new API version.

**Traps to avoid:** Do not rely on the account's default API version. Always pin the version explicitly in client initialization so upgrades are a deliberate code change, not a Dashboard side effect.

## Stripe.js

See [Stripe.js Versioning](https://docs.stripe.com/sdks/stripejs-versioning.md).

Stripe.js is evergreen with biannual major releases (Acacia, Basil, Clover, Dahlia). Load a versioned build via script tag (`https://js.stripe.com/dahlia/stripe.js`) or npm (`@stripe/stripe-js` — major npm versions correspond to Stripe.js versions).

Each Stripe.js version automatically pairs with its corresponding API version (Dahlia Stripe.js → `2026-04-22.dahlia`); this pairing cannot be overridden. When migrating from v3: identify the API version in code, review the changelog, consider updating the API version before switching Stripe.js versions. Stripe supports v3 indefinitely.

## Mobile SDKs

See [Mobile SDK Versioning](https://docs.stripe.com/sdks/mobile-sdk-versioning.md).

- **iOS / Android**: semantic versioning (MAJOR.MINOR.PATCH). New features and fixes release only on the latest major — upgrade regularly.
- **React Native**: 0.x.y schema — minor bumps (x) carry breaking changes AND features; patch bumps (y) are critical fixes only.
- Mobile SDKs work with any backend API version unless documentation says otherwise.

## Upgrade checklist

1. Review the [API Changelog](https://docs.stripe.com/changelog.md) between current and target versions.
1. Update the server-side SDK package (one dependency bump — see `orc:dependency-management` for the loop).
1. Update the pinned `apiVersion` in client initialization.
1. Test against the new version using the `Stripe-Version` header before switching defaults.
1. Update webhook handlers for new event structures; handlers should tolerate unfamiliar event types gracefully.
1. Update Stripe.js and mobile SDK versions if needed.
1. Store Stripe object IDs in columns that accommodate up to 255 characters with case-sensitive collation.

## Testing a new version safely

Use the `Stripe-Version` header to exercise a target version without changing the default:

```bash
curl https://api.stripe.com/v1/customers \
  -u sk_test_xxx: \
  -H "Stripe-Version: 2026-04-22.dahlia"
```

Test webhooks with the new version's event structure before upgrading the account/client default.
