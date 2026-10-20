// The red-CI band row: terminal text, or one SVG strip on rich surfaces. The
// buttons stay real Buttons beside it (register.ts places them).
import type { Els } from '../pane'
import { doc, rect, text, textWidth } from '../draw/svg'
import type { BandRow } from '../band'

export type CiRow = Extract<BandRow, { kind: 'ci' }>
export type CiActions = { diagnose: () => void; dismiss: () => void }

export const ciLine = (row: CiRow) => `CI red on #${row.pr}: ${row.failing.join(', ')}`

export function ciText(els: Els, row: CiRow, actions: CiActions) {
  const { Box, Text, Button } = els
  return Box({ flexDirection: 'row', columnGap: 2, children: [
    Text({ color: 'red', children: ['⛔ ' + ciLine(row)] }),
    Button({ key: 'ci-diagnose', label: 'Diagnose', onPress: actions.diagnose }),
    Button({ key: 'ci-dismiss', label: 'Dismiss', onPress: actions.dismiss }),
  ] })
}

export const ciAlt = (row: CiRow) => ciLine(row)

// A 28px strip: red dot, the line. Width is the text plus padding, capped at `width`.
export function ciSvg(row: CiRow, width: number): string {
  const line = ciLine(row)
  const w = Math.min(width, textWidth(line, 13) + 40)
  const body = rect({ x: 0, y: 2, w, h: 24, r: 12, slot: 'err', opacity: 0.12 }) +
    `<circle cx="14" cy="14" r="4" class="f-err"/>` +
    text({ x: 26, y: 18, s: line, size: 13, slot: 'err', weight: 600 })
  return doc(w, 28, body)
}
