# Packet shapes without a manifest

Read this from step 2 of [SKILL.md](../SKILL.md) only when `qaDir/qa-manifest.json` is absent (a hand-built packet). Fall back to the driver's packet shape:

- **Driver B (Chrome)** → `qa-<branch>.gif` + `steps.md`.
- **Driver A (agent-browser)** → the `ac-*.png` criterion shots + `qa-<branch>.webm` (or its `.gif`) + any failing-step shots + `steps.md`.
