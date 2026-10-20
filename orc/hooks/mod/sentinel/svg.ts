// Desktop drawing of the sentinel note: one <svg> row; the actions stay real
// Buttons beside it (register.ts), never inside.
import { doc, fitSvg, px, rect, text, textWidth } from '../draw/svg'
import type { SentinelNote } from './checks'

const H = 28

export const sentinelAlt = (note: SentinelNote) => `Heads up: ${note.text}`

export function sentinelSvg(note: SentinelNote, columns: number): string | null {
  const w = px(columns), room = Math.max(0, w - 100)
  const max = Math.max(1, Math.floor(room / textWidth('m', 12)))
  const body = note.text.length > max ? note.text.slice(0, Math.max(0, max - 1)) + '…' : note.text
  return fitSvg(doc(w, H, rect({ x: 0, y: 0, w, h: H, r: 6, slot: 'warn', opacity: 0.12 }) +
    text({ x: 10, y: 18, s: '✦ heads up', slot: 'warn', weight: 600 }) +
    text({ x: 92, y: 18, s: body })))
}
