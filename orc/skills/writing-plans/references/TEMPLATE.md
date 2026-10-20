# Plan document template

Disclosed from `orc:writing-plans`. Read when writing the plan file: the mandatory header and the per-task structure every task follows.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## Slice header fields

Semantics of the per-slice annotations shown in the SKILL.md example (`touchpoints`, `parallel_group`, `depends_on`, `acceptance`):

- **`touchpoints`** — the files this slice owns. Evidence-based, never guessed: use the graph (`graphify affected`) or Grep to confirm what the slice actually touches. These become the implementer's file-ownership boundary.
- **`parallel_group`** — two slices share a group **iff** no `depends_on` edge connects them AND their touchpoints are pairwise disjoint. Groups execute in ascending order; slices in the same group may run as parallel implementer dispatches. A slice with any doubt gets its own group — sequential is the safe default.
- **`depends_on`** — slice IDs whose output this slice consumes. Drives group ordering.
- **`acceptance`** — 2–5 **testable** criteria: each names a command to run or an observable behavior, never "works correctly". They are the slice's contract for the implementer and the scoring rubric for QA.
