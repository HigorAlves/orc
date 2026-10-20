import { doc, rect, text, textWidth } from '../draw/svg'
import type { Slot } from '../draw/palette'
import type { TouchedRow } from './model'
import { SHOWN } from './text'

const ROW = 20
export const touchedHeight = (rows: TouchedRow[]) => Math.min(rows.length, SHOWN) * ROW + 4

export const touchedAlt = (rows: TouchedRow[]) => {
  const n = (k: TouchedRow['kind']) => rows.filter(r => r.kind === k).length
  return `${rows.length} files touched in this slice: ${n('committed')} committed, ${n('edit')} edited, ${n('read')} read`
}

const TONE: Record<TouchedRow['kind'], Slot> = { read: 'muted', edit: 'warn', committed: 'ok' }

// One strip: a status dot, the path, a +/- change bar, the kind and age.
export function touchedSvg(rows: TouchedRow[], width: number): string {
  const shown = rows.slice(0, SHOWN)
  const right = 120
  const barX = Math.max(160, width - right - 110)
  const body = shown.map((r, i) => {
    const y = 2 + i * ROW
    const max = Math.max(1, Math.floor((barX - 30) / textWidth('m')))
    const path = r.path.length > max ? '…' + r.path.slice(-(max - 1)) : r.path
    const total = (r.add ?? 0) + (r.del ?? 0)
    const w = r.add != null && r.del != null ? Math.min(100, 10 + total) : 0
    const addW = total ? Math.round((w * (r.add ?? 0)) / total) : 0
    return `<circle cx="8" cy="${y + 10}" r="4" class="f-${TONE[r.kind]}"/>` +
      text({ x: 20, y: y + 14, s: path, slot: r.kind === 'read' ? 'muted' : 'ink' }) +
      (w ? rect({ x: barX, y: y + 6, w: addW, h: 8, r: 2, slot: 'ok' }) + rect({ x: barX + addW, y: y + 6, w: w - addW, h: 8, r: 2, slot: 'err' }) : '') +
      text({ x: width - 8, y: y + 14, s: `${r.kind} ${r.age}`, size: 11, slot: TONE[r.kind], anchor: 'end' })
  }).join('')
  return doc(width, touchedHeight(rows), body)
}
