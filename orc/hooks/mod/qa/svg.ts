import { doc, esc, rect, text, textWidth } from '../draw/svg'
import type { QaShot } from './model'

const GAP = 10, LABEL = 22

export const qaAlt = (shots: QaShot[]) =>
  `${shots.length} QA screenshot${shots.length === 1 ? '' : 's'}: ${shots.map(s => s.criterion || s.name).join('; ')}`

export function qaHeight(width: number, n: number) {
  return thumbSize(width, n).h + LABEL
}

function thumbSize(width: number, n: number) {
  const w = Math.min(240, Math.floor((width - GAP * (n - 1)) / Math.max(1, n)))
  return { w, h: Math.round(w * 0.625) }
}

// Thumbnails side by side, each a data: jpeg with its criterion underneath.
export function qaSvg(shots: QaShot[], width: number): string {
  const { w, h } = thumbSize(width, shots.length)
  const max = Math.max(4, Math.floor(w / textWidth('m')))
  const body = shots.map((s, i) => {
    const x = i * (w + GAP)
    const label = (s.criterion || s.name)
    return rect({ x, y: 0, w, h, r: 4, slot: 'line' })
      + `<image x="${x}" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="data:image/jpeg;base64,${esc(s.b64 ?? '')}"/>`
      + text({ x, y: h + 15, s: label.length > max ? label.slice(0, max - 1) + '…' : label, size: 11, slot: 'muted' })
  }).join('')
  return doc(width, h + LABEL, body)
}
