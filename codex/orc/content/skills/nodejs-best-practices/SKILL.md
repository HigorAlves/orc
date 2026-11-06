---
name: nodejs-best-practices
description: "Node.js development principles and decision-making. Framework selection, async patterns, security, and architecture. Teaches thinking, not copying."
risk: unknown
source: community
date_added: "2026-02-27"
---

# Node.js Best Practices

> Principles and decision-making for Node.js development in 2025.
> **Learn to THINK, not memorize code patterns.**

## When to Use
Use this skill when making Node.js architecture decisions, choosing frameworks, designing async patterns, or applying security and deployment best practices.

---

## ⚠️ How to Use This Skill

This skill teaches **decision-making principles**, not fixed code to copy.

- ASK user for preferences when unclear
- Choose framework/pattern based on CONTEXT
- Don't default to same solution every time

---

## Principles by topic

Read the file for the decision at hand; each holds the original numbered sections.

- Choosing a framework, runtime, or module system → [FRAMEWORK-AND-RUNTIME.md](references/FRAMEWORK-AND-RUNTIME.md) (§1–2)
- Layering, error handling, async patterns → [ARCHITECTURE-ERRORS-ASYNC.md](references/ARCHITECTURE-ERRORS-ASYNC.md) (§3–5)
- Validation, security, testing → [VALIDATION-SECURITY-TESTING.md](references/VALIDATION-SECURITY-TESTING.md) (§6–8)

---

## 10. Anti-Patterns to Avoid

### ❌ DON'T:
- Use Express for new edge projects (use Hono)
- Use sync methods in production code
- Put business logic in controllers
- Skip input validation
- Hardcode secrets
- Trust external data without validation
- Block event loop with CPU work

### ✅ DO:
- Choose framework based on context
- Ask user for preferences when unclear
- Use layered architecture for growing projects
- Validate all inputs
- Use environment variables for secrets
- Profile before optimizing

---

## 11. Decision Checklist

Before implementing:

- [ ] **Asked user about stack preference?**
- [ ] **Chosen framework for THIS context?** (not just default)
- [ ] **Considered deployment target?**
- [ ] **Planned error handling strategy?**
- [ ] **Identified validation points?**
- [ ] **Considered security requirements?**

---

> **Remember**: Node.js best practices are about decision-making, not memorizing patterns. Every project deserves fresh consideration based on its requirements.

## Limitations
- Use this skill only when the task clearly matches the scope described above.
- Do not treat the output as a substitute for environment-specific validation, testing, or expert review.
- Stop and ask for clarification if required inputs, permissions, safety boundaries, or success criteria are missing.
