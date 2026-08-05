---
name: jira-hierarchy
description: "The Jira backlog contract — Epic-as-micro-PRD, Stories as user-facing increments under an active Epic, Tasks/Sub-tasks/Bugs atomized for conflict-free parallel development, and the mandatory Description / Desired Behavior / Acceptance Criteria template on every child ticket. Use when creating or restructuring Jira epics, stories, or task breakdowns, or when enforcing ticket structure — /orc:jira-breakdown and orc-jira-architect are built on it."
---

# Jira hierarchy contract

One structure, defined once. `/orc:jira-breakdown` orchestrates it,
`orc-jira-architect` drafts against it, and any ticket-writing surface
(`/orc:jira`, `orc:to-issues` in Jira mode) conforms to it.

## The three levels

| Level | Role | Rule |
|---|---|---|
| **Epic** | The micro-PRD for a feature set — alignment lives here, not in a wiki | Carries all five PRD sections (below). One Epic per coherent feature set. |
| **Story** | A user-facing functional increment of the Epic | MUST parent to an **active** Epic (status not Done/Closed/Resolved). No orphan Stories, ever. |
| **Task / Sub-task / Bug** | Atomic execution units | Sliced so N developers work the same Story concurrently without touching the same files. Aggressive breakdown beats big tickets. |

## Epic = micro-PRD (required sections)

Every Epic description carries exactly these five sections, as headings:

1. **Executive Summary & Problem Statement** — what and why, ≤2 paragraphs.
2. **Business Objectives & Key Metrics** — what changes for whom; how success is measured.
3. **Architecture & Technical Overview** — the shape of the solution; systems touched.
4. **Scope** — explicit **In-Scope** and **Out-of-Scope** lists. Out-of-scope is load-bearing: it's what stops scope creep at triage time.
5. **Dependencies & Technical Risks** — upstream teams, external systems, migrations, and what could sink it.

## The mandatory child template (no exceptions)

Every Story, Task, Sub-task, and Bug uses exactly this layout:

```
Description:
[Clear summary of context, current state, or technical background]

Desired Behavior:
[Detailed breakdown of expected system behavior, UI design, or bug fix]

Acceptance Criteria:
- [Testable condition 1]
- [Testable condition 2]
```

- Acceptance criteria are **testable** — a reviewer can answer yes/no per line. "Works correctly" is not a criterion.
- A ticket missing any of the three sections is malformed: fix it before creation, never create-then-fix.
- Via `acli`, multi-section descriptions MUST be ADF JSON (`orc:jira-cli` § ADF) — headings and bullet lists don't survive as bare strings.

## Atomization for concurrency

The point of the Task layer is parallel throughput, not bookkeeping:

- **Disjoint touchpoints.** Each Task names the files/modules it owns; two Tasks in the same parallel group must not share them. Same doctrine as `/orc:flow`'s parallel-safe slices — a code graph (`graphify`) or Glob survey grounds the split.
- **Sized to one sitting.** A Task a developer can't finish in one focused session is two Tasks.
- **Dependencies explicit.** A Task that must wait declares it — the ordering lands as Jira `Blocks` links, not as tribal knowledge.
- **Bugs are first-class units** — same template, same parenting, same sizing.

## Parenting mechanics (acli)

- Story → Epic and Sub-task → Story via `--parent <KEY>` at creation (`orc:jira-cli`). Sub-task without `--parent` silently becomes the project's default type — always pair them.
- Standalone Tasks/Bugs that a project won't accept under a Story: parent them to the Epic and add a `Relates to` link to the Story (`acli jira workitem link create`).
- Dependency ordering: `link create --out <blocker> --in <blocked> --type Blocks`.

## Verification duties (whoever creates tickets)

1. **Active parent first.** Before generating any child, verify the parent Epic exists and is active — or create the Epic (full micro-PRD) in the same run, gated by a preview.
2. **Template check before creation.** All three sections present on every child in the batch. One malformed ticket blocks the batch.
3. **Concurrency check.** Within each parallel group, touchpoint sets are pairwise disjoint; overlaps demote a Task into a dependency (`Blocks`) instead.
