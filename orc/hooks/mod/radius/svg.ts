import { doc, fitSvg, px, rect, text } from '../draw/svg'
import type { Radius } from './model'
import { radiusLine } from './text'

export const RADIUS_H = 54
export const radiusAlt = radiusLine

// A gauge: the diff's LOC as a bar that turns red past the budget, a marker at the budget, the same words underneath.
export function radiusSvg(m: Radius, columns: number): string | null {
  const w = px(columns), inner = w - 24, scale = Math.max(m.loc, m.budget, 1)
  const at = (n: number) => Math.round(inner * n / scale)
  const ok = Math.min(m.loc, m.budget)
  let body = rect({ x: 12, y: 8, w: inner, h: 10, r: 5, slot: 'line' })
  if (ok > 0) body += rect({ x: 12, y: 8, w: at(ok), h: 10, r: 5, slot: 'ok' })
  if (m.loc > m.budget) body += rect({ x: 12 + at(m.budget), y: 8, w: at(m.loc) - at(m.budget), h: 10, slot: 'err' })
  body += rect({ x: 12 + at(m.budget) - 1, y: 4, w: 2, h: 18, slot: 'muted' })
  body += text({ x: 12, y: 40, s: radiusLine(m), size: 12, slot: m.loc > m.budget ? 'err' : 'ink' })
  return fitSvg(doc(w, RADIUS_H, body))
}
