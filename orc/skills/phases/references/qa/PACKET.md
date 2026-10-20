<!-- orc:qa/PACKET -->
_Loaded on demand via orc:phases. Do not run this phase from memory — this file is the phase._

# Packet contract (web mode)

The `qa/` directory MUST hold the driver's full packet. `orc:qa/P5` checks it before the verdict.

| Artifact | Driver P — playwright | Driver A — agent-browser | Driver B — chrome |
|----------|-----------------------|--------------------------|-------------------|
| Visual proof | `trace-<id>.zip` per scenario (screenshots inside) | `screenshot-NN-<step>.png` per golden-path step (`--annotate`) + edge-case shots | in-conversation screenshots, referenced by step number in `steps.md` (`Write` cannot emit binary) |
| Criterion proof | `qa-<branch>.webm#t=<chapter>` + the `test.step` title | `ac-<sliceId>-<idx>-<slug>.png` per scored criterion | the numbered `### Step <N>` anchor a criterion's `evidence` points at |
| Motion proof | `qa-<branch>.webm` stitched (ffmpeg) | `qa-<branch>.webm` (`agent-browser record` — needs `ffmpeg`) (+ optional `.gif` for ticket embedding) | `qa-<branch>.gif` (`gif_creator`, edge cases included) |
| Manifest | `qa-manifest.json` (`video.chapters`) | `qa-manifest.json` | `qa-manifest.json` |
| A11y snapshot | `trace-<id>.zip` (ARIA snapshots per action) | `snapshot-final.txt` (`agent-browser snapshot`) | `snapshot-final.txt` (`read_page` output) |
| Console | `console-<id>.log` | `console.log` (`agent-browser console`) | `console.log` (`read_console_messages`; state any filter used) |
| Network | `trace-<id>.zip` | `network.har` (`agent-browser network har stop`) | `network-summary.md` (distilled `read_network_requests`) |
| Narrative | `steps.md` | `steps.md` | `steps.md` (same template) |

Motion proof: mandatory whenever the change touches a rendered surface. Two exemptions, each stated as a one-line reason in `steps.md`, never omitted silently:

- a non-visual change;
- Driver A only: `ffmpeg` not installed. agent-browser's recorder wraps ffmpeg, so a headless run without it captures stills only. The Claude-in-Chrome driver's `gif_creator` has no such dependency.

Every acceptance criterion MUST appear in `qa-manifest.json` with a result; a `skipped` row says why.

Bonus evidence, NOT required: `trace.json` (Chrome DevTools trace), `react-renders.json`, `vitals.json`. Add these only when relevant to the change.

The chrome driver trades HAR-grade network capture and request mocking for live visibility. That is the user's call at the gate, not a loophole: its packet above stays mandatory in full.

Blocked callout, printed when a required artifact is missing; the user closes the gap before any "ready to PR" claim:

```markdown
> **🛑 Blocked — QA evidence incomplete**
>
> Missing: <artifact list>. No "QA passed" claim without the full evidence packet.
```
