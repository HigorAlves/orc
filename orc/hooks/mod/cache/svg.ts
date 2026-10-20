// Desktop drawing of the cache band row: one strip; the Keep warm button stays a real Button beside it.
import { doc, rect, text, textWidth } from '../draw/svg'
import { cacheLine, type CacheRow } from './text'

export function cacheSvg(r: CacheRow, width: number): string {
  const line = cacheLine(r)
  const w = Math.min(width, textWidth(line, 13) + 40)
  const body = rect({ x: 0, y: 2, w, h: 24, r: 12, slot: 'warn', opacity: 0.14 }) +
    `<circle cx="14" cy="14" r="4" class="f-warn"/>` +
    text({ x: 26, y: 18, s: line, size: 13, slot: 'warn', weight: 600 })
  return doc(w, 28, body)
}
