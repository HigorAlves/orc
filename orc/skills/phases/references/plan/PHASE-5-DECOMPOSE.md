<!-- orc:plan/P5 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 5 — Decompose into issues (`--issues` only)

> **🛑 Outward write**
>
> Step 1 creates issues on the project tracker.

1. Invoke `orc:to-issues` to break the approved plan into vertical-slice issues on the tracker.
2. Save the issue map to `.orc/<branch>/files/issues.md`.
3. Bump `checkpoint.md` to phase=done.
