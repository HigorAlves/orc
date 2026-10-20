// Renders the orc mod's real Claude Desktop surfaces (orc/hooks/mod/*/svg.ts)
// with sample data into public/surfaces/<name>-{light,dark}.svg.
// Widths are the narrowest each renderer lays out cleanly at today: touched
// overlaps below ~390px, radius needs ~450px, progress overflows below ~600px.
// The mod's SVGs pick light or dark with an inner prefers-color-scheme query;
// the site needs both variants so its own theme toggle can choose.
//   bun scripts/surfaces.ts
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { progressSvg, agentSvg } from "../../orc/hooks/mod/progress/svg"
import { touchedSvg } from "../../orc/hooks/mod/touched/svg"
import { radiusSvg } from "../../orc/hooks/mod/radius/svg"
import { guardSvg } from "../../orc/hooks/mod/guard/svg"
import { summarize } from "../../orc/hooks/mod/guard/measure"
import { replaySvg } from "../../orc/hooks/mod/replay/svg"
import { replayView, recordEdit, REPLAY_INITIAL } from "../../orc/hooks/mod/replay/model"
import { cacheSvg } from "../../orc/hooks/mod/cache/svg"
import { sentinelSvg } from "../../orc/hooks/mod/sentinel/svg"
import { retroSvg } from "../../orc/hooks/mod/retro/svg"
import { ciSvg } from "../../orc/hooks/mod/band/ci"
import { contextChipSvg } from "../../orc/hooks/mod/cockpit"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/surfaces")

const surfaces: Record<string, string | null> = {
  progress: progressSvg({ title: "PROJ-142-csv-export", phase: 5, phaseLabel: "implement", totalPhases: 9, done: 2, running: 2, total: 4, qa: null, pr: null, agents: 2, next: "slice 3 · download button" }, 640),
  "agent-a": agentSvg({ name: "impl-a", type: "orc-implementer", slice: "3", step: "green · running suite", ctxPct: 41, usd: 0.62, elapsed: "3m12s", running: true }, 640),
  "agent-b": agentSvg({ name: "impl-b", type: "orc-implementer", slice: "4", step: "red · writing test", ctxPct: 18, usd: 0.21, elapsed: "1m05s", running: true }, 640),
  touched: touchedSvg([
    { path: "src/ui/ExportButton.tsx", kind: "edit", add: 46, del: 0, age: "1m" },
    { path: "src/reports/csv.ts", kind: "edit", add: 84, del: 3, age: "2m" },
    { path: "src/reports/api.ts", kind: "committed", add: 31, del: 9, age: "9m" },
    { path: "src/reports/__tests__/export.test.ts", kind: "committed", add: 58, del: 0, age: "11m" },
    { path: "src/reports/types.ts", kind: "read", add: null, del: null, age: "12m" },
  ], 392),
  radius: radiusSvg({ loc: 288, budget: 300, files: 6, dependents: 11 }, 56),
  replay: replaySvg(replayView(recordEdit(REPLAY_INITIAL, { sliceId: 2, path: "src/reports/api.ts", tool: "Edit", old: "router.get('/reports/:id', show)", new: "router.get('/reports/:id', show)\nrouter.get('/reports/:id/export.csv', exportCsv)", at: 1 }), { slice: 0, step: 0 })!, 49),
  guard: guardSvg(summarize("clean", ["Would remove dist/\nWould remove coverage/\nWould remove .env.local\nWould remove tmp/export-fixture.csv\n"]), 55),
  cache: cacheSvg({ kind: "cache", minutesLeft: 6, rewriteUsd: 1.84, tokens: 142_000, waitingOn: "orc-implementer" }, 440),
  sentinel: sentinelSvg({ id: "outside-slice", text: "Edit to src/billing/plan.ts is outside slice 3" } as never, 55),
  retro: retroSvg({ kind: "retro", id: "r1", rule: "use pnpm, not npm, in this repo", seen: 2 }, 440),
  ci: ciSvg({ kind: "ci", pr: 128, failing: ["lint", "e2e"] }, 440),
  chip: contextChipSvg(58, [22_000, 48_000, 71_000, 96_000, 116_000], 200_000),
}

export function variants(svg: string): { light: string; dark: string } {
  const m = svg.match(/@media \(prefers-color-scheme: dark\)\{([\s\S]*?\})\}<\/style>/)
  if (!m || m.index === undefined) throw new Error("surface has no dark palette block")
  const head = svg.slice(0, m.index)
  const tail = svg.slice(m.index + m[0].length)
  return { light: `${head}</style>${tail}`, dark: `${head}${m[1]}</style>${tail}` }
}

mkdirSync(OUT, { recursive: true })
for (const [name, svg] of Object.entries(surfaces)) {
  if (!svg) throw new Error(`surface ${name} rendered nothing`)
  const { light, dark } = variants(svg)
  writeFileSync(join(OUT, `${name}-light.svg`), light)
  writeFileSync(join(OUT, `${name}-dark.svg`), dark)
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/) ?? []
  console.log(`${name.padEnd(9)} ${w}x${h}`)
}
