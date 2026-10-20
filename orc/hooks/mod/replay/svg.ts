// Desktop drawing of one replay step: step pills plus colored diff lines.
import { chip, chipWidth, doc, esc, fitSvg, px, rect, text } from '../draw/svg'
import type { Slot } from '../draw/palette'
import type { ReplayViewModel } from './model'

export const MAX_SHOWN = 12
const LINE_H = 16

export const replayAlt = (v: ReplayViewModel) =>
  `Replay: slice ${v.sliceId}, step ${v.step + 1} of ${v.steps}, ${v.tool} ${v.path}, +${v.add} -${v.del}`

export function replaySvg(v: ReplayViewModel, columns: number): string | null {
  const w = px(columns)
  const shown = v.diff.split('\n').slice(2, 2 + MAX_SHOWN)
  const more = v.diff ? Math.max(0, v.diff.split('\n').length - 2 - MAX_SHOWN) : 0
  const maxChars = Math.max(10, Math.floor((w - 24) / 7))
  let body = text({ x: 12, y: 20, s: `Slice ${v.sliceId} · ${v.sliceIdx + 1}/${v.sliceCount} · ${v.tool} ${v.path}`, size: 13, weight: 600 })
  body += chip({ x: w - 12 - chipWidth(`+${v.add} -${v.del}`), y: 6, label: `+${v.add} -${v.del}`, tone: 'muted' })
  let x = 12
  for (let i = 0; i < v.steps && x < w - 24; i++, x += 30) {
    const on = i === v.step
    body += rect({ x, y: 32, w: 24, h: 18, r: 9, slot: on ? 'info' : 'line', opacity: on ? 0.9 : 1 })
    body += text({ x: x + 12, y: 45, s: String(i + 1), size: 11, slot: on ? 'surface' : 'muted', anchor: 'middle' })
  }
  let y = 66
  for (const l of shown) {
    const slot: Slot = l[0] === '+' ? 'ok' : l[0] === '-' ? 'err' : l.startsWith('@@') ? 'info' : 'muted'
    if (slot === 'ok' || slot === 'err') body += rect({ x: 6, y: y - 12, w: w - 12, h: LINE_H, r: 2, slot, opacity: 0.12 })
    body += `<text data-diff="1" x="12" y="${y}" font-size="12" font-family="ui-monospace, Menlo, monospace" xml:space="preserve" class="f-${slot}">${esc(l.slice(0, maxChars))}</text>`
    y += LINE_H
  }
  if (more) { body += text({ x: 12, y, s: `… ${more} more lines`, size: 11, slot: 'muted' }); y += LINE_H }
  if (!shown.length) { body += text({ x: 12, y, s: '(no line changes)', size: 11, slot: 'muted' }); y += LINE_H }
  return fitSvg(doc(w, y + 4, body))
}
