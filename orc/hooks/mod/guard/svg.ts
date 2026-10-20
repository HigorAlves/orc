import { doc, fitSvg, px, rect, text, textWidth } from '../draw/svg'
import type { GuardSummary } from './measure'

const ROW = 16, SHOWN = 5

const clip = (s: string, w: number) => (textWidth(s, 11) <= w ? s : s.slice(0, Math.max(1, Math.floor(w / (11 * 7 / 12)) - 1)) + '…')

// A card: headline, an added/removed (or severity) change bar, a few items.
export function guardSvg(s: GuardSummary, columns: number): string | null {
  const w = px(columns), inner = w - 24
  const shown = s.items.slice(0, SHOWN)
  const h = 56 + shown.length * ROW + (s.total > shown.length ? ROW : 0)
  let body = rect({ x: 0.5, y: 0.5, w: w - 1, h: h - 1, r: 8, slot: 'surface' }) + text({ x: 12, y: 22, s: clip(s.headline, inner), size: 13, weight: 600 })
  const add = s.add ?? 0, del = s.del ?? 0, sum = add + del
  if (sum > 0) {
    const aw = Math.round(inner * add / sum)
    body += rect({ x: 12, y: 32, w: aw, h: 6, r: 3, slot: 'ok' }) + rect({ x: 12 + aw, y: 32, w: inner - aw, h: 6, r: 3, slot: 'err' })
  } else {
    body += rect({ x: 12, y: 32, w: inner, h: 6, r: 3, slot: 'line' }) + rect({ x: 12, y: 32, w: Math.round(inner * Math.min(1, s.total / 20)), h: 6, r: 3, slot: 'err' })
  }
  shown.forEach((it, i) => { body += text({ x: 12, y: 56 + i * ROW, s: clip(it, inner), size: 11, slot: 'muted' }) })
  if (s.total > shown.length) body += text({ x: 12, y: 56 + shown.length * ROW, s: `+${s.total - shown.length} more`, size: 11, slot: 'muted' })
  return fitSvg(doc(w, h, body))
}
