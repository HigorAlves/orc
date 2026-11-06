# segments.json schema (version 1)

```json
{ "schema": 1, "branch": "feat-x", "style": "isometric", "voice": "af_heart", "segments": [
  { "id": "s01", "kind": "graphic", "title": "Hello", "lines": ["a", "b"], "narration": "Intro." },
  { "id": "s02", "kind": "clip", "source": "demo/clip.webm", "caption": "AC 1.1 — works", "narration": "Clip." } ] }
```

| Field | Applies to | Rule |
|---|---|---|
| `schema` | doc | must be `1` |
| `branch` | doc | sanitized branch, used in the output filename |
| `style` | doc | one of animate's seven: `cut-paper`, `crosshatch`, `isometric`, `math`, `pixel`, `riso`, `sketchbook` |
| `voice` | doc | kokoro voice id; `af_heart` default, `pf_dora` / `pm_alex` for pt-BR |
| `id` | segment | slug, unique within the doc |
| `kind` | segment | `graphic` or `clip` |
| `title`, `lines[]` | graphic only | `title` required; `lines` optional beat lines |
| `source` | clip only | required; path relative to `<qa-dir>` |
| `caption` | clip | optional burned-in caption |
| `narration` | segment | required; spoken text, ≤ 25 words |

`orc-explain validate --segments S` enforces these (exit 2 naming the segment id).
