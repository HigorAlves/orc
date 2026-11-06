# Architecture, error handling, async

Sections 3–5: layered structure, centralized errors and status codes, async pattern choice and event-loop awareness. Read from [SKILL.md](../SKILL.md); the decision checklist and anti-patterns live there.

## 3. Architecture Principles

### Layered Structure Concept

```
Request Flow:
│
├── Controller/Route Layer
│   ├── Handles HTTP specifics
│   ├── Input validation at boundary
│   └── Calls service layer
│
├── Service Layer
│   ├── Business logic
│   ├── Framework-agnostic
│   └── Calls repository layer
│
└── Repository Layer
    ├── Data access only
    ├── Database queries
    └── ORM interactions
```

### Why This Matters:
- **Testability**: Mock layers independently
- **Flexibility**: Swap database without touching business logic
- **Clarity**: Each layer has single responsibility

### When to Simplify:
- Small scripts → Single file OK
- Prototypes → Less structure acceptable
- Always ask: "Will this grow?"

---

## 4. Error Handling Principles

### Centralized Error Handling

```
Pattern:
├── Create custom error classes
├── Throw from any layer
├── Catch at top level (middleware)
└── Format consistent response
```

### Error Response Philosophy

```
Client gets:
├── Appropriate HTTP status
├── Error code for programmatic handling
├── User-friendly message
└── NO internal details (security!)

Logs get:
├── Full stack trace
├── Request context
├── User ID (if applicable)
└── Timestamp
```

### Status Code Selection

| Situation | Status | When |
|-----------|--------|------|
| Bad input | 400 | Client sent invalid data |
| No auth | 401 | Missing or invalid credentials |
| No permission | 403 | Valid auth, but not allowed |
| Not found | 404 | Resource doesn't exist |
| Conflict | 409 | Duplicate or state conflict |
| Validation | 422 | Schema valid but business rules fail |
| Server error | 500 | Our fault, log everything |

---

## 5. Async Patterns Principles

### When to Use Each

| Pattern | Use When |
|---------|----------|
| `async/await` | Sequential async operations |
| `Promise.all` | Parallel independent operations |
| `Promise.allSettled` | Parallel where some can fail |
| `Promise.race` | Timeout or first response wins |

### Event Loop Awareness

```
I/O-bound (async helps):
├── Database queries
├── HTTP requests
├── File system
└── Network operations

CPU-bound (async doesn't help):
├── Crypto operations
├── Image processing
├── Complex calculations
└── → Use worker threads or offload
```

### Avoiding Event Loop Blocking

- Never use sync methods in production (fs.readFileSync, etc.)
- Offload CPU-intensive work
- Use streaming for large data
