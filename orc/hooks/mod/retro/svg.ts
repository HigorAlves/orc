// Desktop drawing of the retro rule card: one <svg>; Save/Edit/Skip stay real Buttons beside it.
import { doc, rect, text, textWidth } from '../draw/svg'
import { retroLine, type RetroRow } from './text'

export function retroSvg(r: RetroRow, width: number): string {
  const line = retroLine(r)
  const w = Math.min(width, textWidth(line, 13) + 40)
  return doc(w, 28, rect({ x: 0, y: 2, w, h: 24, r: 12, slot: 'info', opacity: 0.14 }) +
    text({ x: 14, y: 18, s: line, size: 13, slot: 'info', weight: 600 }))
}
