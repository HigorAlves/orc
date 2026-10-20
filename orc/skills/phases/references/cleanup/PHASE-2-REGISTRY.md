<!-- orc:cleanup/P2 -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Phase 2 — Read the registry

1. Read `.orc/orc.json`; in workspace mode, `${ORC_STATE_DIR}/orc.json` (Phase 0).
2. If the file is absent or empty, print that and stop.
3. If the requested session is missing from it, print that and stop.

NOTE: never no-op silently.
