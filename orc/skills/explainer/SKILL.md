---
name: explainer
description: "Build the narrated what-was-made walkthrough for a QA packet: script from plan + acceptance, demo pass, segments.json, animate graphics, kokoro narration, orc-explain assemble. Use from /orc:explain and the flow explainer gate. Not for QA itself."
---

# Explainer

**Announce at start:** "I'm using the explainer skill to build the narrated walkthrough."

Inputs: `<qa-dir>` with `qa-manifest.json`, the session's `plan.md` (optional), `ORC_TARGET_JSON` (for the demo pass; resolve the target per `orc:qa-targets`), settings `explainer_style` (`CLAUDE_PLUGIN_OPTION_EXPLAINER_STYLE`, default `isometric`) and `explainer_voice` (`CLAUDE_PLUGIN_OPTION_EXPLAINER_VOICE`, default `af_heart`).

## 1. Toolchain
`orc-explain setup` (first run: npm install kokoro-js into the user cache; model downloads on first narration). `command -v ffmpeg` missing ⇒ stop with one line, no explainer. animate missing ⇒ say `graphic segments will be plain title cards` and continue.

## 2. Demo footage
If `<qa-dir>/demo/` lacks a `.webm` per `@golden` scenario: `( cd <repo>/<dir> && ORC_TARGET_JSON=… ORC_PW_OUTPUT_DIR=<qa-dir>/pw-demo npx playwright test --project=demo )`, then `orc-qa-video plan --results <qa-dir>/pw-demo/results.json` and copy each `video` to `<qa-dir>/demo/<id>.webm`.

## 3. Script → `segments.json` (schema: `references/segments-schema.md`)
Sources, in order: the plan's slice titles + acceptance (what was built), the manifest's acceptance rows (what was proven), `git log --format=%s <base>..HEAD` (what changed). **Never the raw diff** — the script describes behaviour, not code. Shape: `s01` graphic (feature title + 2–3 lines), one clip segment per golden scenario (caption = the first `AC` title that scenario proves; narration = one sentence of what the viewer sees), `sNN` graphic outcome (criteria passed/total, notable skips). Narration lines ≤ 25 words, present tense, no file names. Total target ≤ 90 seconds. `style` from setting, `voice` from setting.

## 4. Explainer gate (soft-inward, header `Explainer`; `guided`/`full` pre-approve)
```markdown
> **⛔ Gate — explainer**
>
> <N> segments, ~<seconds>s, style <style>, voice <voice>. Review the script before rendering.
```
preview = `segments.json` rendered as `id · kind · caption/title · narration`. Options: **Render (Recommended)** · **Edit script** (apply the user's wording changes, re-show) · **Cancel**.

## 5. Render
Authoring and rendering are render work, not a new gate: the Explainer gate above (script + segments + style) already covered them.

1. `orc-explain narrate --segments S --work <qa-dir>/explain`.
2. **Scene authoring** (only when animate is installed; otherwise skip, fallback cards apply). Run `orc-explain graphics --segments S --work <qa-dir>/explain` once to create `<work>/pieces/<id>/` (`piece.json`, `brief.md`, the example's `src/`). Then, for each graphic segment, author `src/scenes.js` (and the `TIMELINE` in `src/head.html`) from that piece's `brief.md`, following animate's `craft.md` and the chosen style's `STYLE.md` + `kit.js` under `<animate skill root>/styles/<style>/`. One card-like scene per piece: the headline, then the lines, 16:9, timed to the narration length (`ffprobe -v error -show_entries format=duration -of csv=p=0 <work>/narration/<id>.wav`).
3. `ORC_ANIMATE_RENDER=1 orc-explain graphics --segments S --work <qa-dir>/explain` (render pass reuses the authored pieces, never regenerates them).
4. `orc-explain assemble --segments S --work <qa-dir>/explain --qa-dir <qa-dir> --out <qa-dir>/explainer-<branch>.mp4`.

Then add to `qa-manifest.json`: `explainer: { file: "explainer-<branch>.mp4", segments: "explain/segments.json" }`, append the file to `artifacts[]` (role `explainer`) and `curated[]`; append `## Explainer — <ISO>` to `steps.md` (segments, duration, style, voice, animate used yes/no). Delivery is `orc:evidence-publish`'s job (same gates; the PR comment links it as `EXPLAINER_URL`).

`graphics` writes an animate piece per graphic segment under `<work>/pieces/` and uses fallback cards unless the scenes were authored and `ORC_ANIMATE_RENDER=1` (see `animate.lock` notes: animate pieces are hand-authored canvas scenes, not data-driven).
