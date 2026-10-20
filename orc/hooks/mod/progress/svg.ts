import { chip, chipWidth, doc, ring, segments, text, textWidth } from '../draw/svg'
import type { Slot } from '../draw/palette'
import { agentRowLine, type AgentRow, type ProgressModel } from './model'

const H = 28

export const progressAlt = (m: ProgressModel) =>
  `orc ${m.title}: phase ${m.phase} of ${m.totalPhases}${m.phaseLabel ? ' ' + m.phaseLabel : ''}, ${m.done} of ${m.total} slices done, ${m.running} running`

// The orc mark, scaled to 18px.
const mark = (x: number) =>
  `<svg x="${x}" y="5" width="18" height="18" viewBox="6 7 52 52">` +
  '<circle cx="32" cy="33" r="20" fill="none" stroke-width="9" class="s-ok"/>' +
  '<path d="M22 47C22 41 23.5 37 26.5 33C26.5 38 27.5 44 28.5 50Z" class="f-ok"/>' +
  '<path d="M42 47C42 41 40.5 37 37.5 33C37.5 38 36.5 44 35.5 50Z" class="f-ok"/></svg>'

export function progressSvg(m: ProgressModel, width: number): string {
  const qaTone: Slot = m.qa === 'pass' ? 'ok' : m.qa === 'fail' ? 'err' : m.qa === 'partial' ? 'warn' : 'muted'
  const chips = [
    { label: `QA ${m.qa ?? '—'}`, tone: qaTone },
    { label: `PR ${m.pr ?? '—'}`, tone: (m.pr != null ? 'info' : 'muted') as Slot },
    ...(m.agents > 0 ? [{ label: `×${m.agents}`, tone: 'violet' as Slot }] : []),
  ]
  const chipsW = chips.reduce((n, c) => n + chipWidth(c.label) + 6, 0)
  let x = 24
  let body = mark(0) + text({ x, y: 18, s: m.title, weight: 600 })
  x += textWidth(m.title) + 12
  for (let i = 1; i <= m.totalPhases; i++) {
    const cls = i < m.phase ? 'f-ok' : i === m.phase ? 's-warn' : 'f-line'
    body += `<circle data-phase="${i}" cx="${x + 4}" cy="14" r="${i === m.phase ? 3 : 4}" class="${cls}"` +
      (i === m.phase ? ' fill="none" stroke-width="2"' : '') + '/>'
    x += 11
  }
  x += 4
  if (m.phaseLabel) { body += text({ x, y: 18, s: m.phaseLabel, slot: 'muted' }); x += textWidth(m.phaseLabel) + 12 }
  const count = `${m.done}/${m.total}`
  const countW = textWidth(count) + 8
  const barW = Math.max(40, width - x - countW - chipsW - 8)
  body += segments({ x, y: 10, w: barW, h: 8, done: m.done, running: m.running, total: m.total })
  x += barW + 8
  body += text({ x, y: 18, s: count, weight: 600 })
  x += countW
  for (const c of chips) { body += chip({ x, y: 5, label: c.label, tone: c.tone }); x += chipWidth(c.label) + 6 }
  return doc(width, H, body)
}

// One cockpit agent row: context ring, name + step, cost and time. Height 36.
export const AGENT_H = 36
export const agentLabel = (r: AgentRow) => r.type ?? r.name

export const agentAlt = (r: AgentRow) =>
  `${agentLabel(r)}${r.step ? ' ' + r.step : ''}, ${agentRowLine(r)}${r.running ? '' : ', finished'}`

export function agentSvg(r: AgentRow, width: number): string {
  const slot: Slot = !r.running ? 'muted' : r.ctxPct != null && r.ctxPct >= 80 ? 'err' : r.ctxPct != null && r.ctxPct >= 60 ? 'warn' : 'ok'
  const right = [r.usd != null ? `$${r.usd.toFixed(2)}` : '$—', r.elapsed].join(' · ')
  return doc(width, AGENT_H,
    ring({ cx: 18, cy: 18, r: 10, value: (r.ctxPct ?? 0) / 100, slot }) +
    text({ x: 38, y: 15, s: agentLabel(r), weight: 600, slot: r.running ? 'ink' : 'muted' }) +
    text({ x: 38, y: 29, s: r.step || (r.running ? 'working' : 'finished'), size: 11, slot: 'muted' }) +
    text({ x: width - 8, y: 15, s: right, size: 11, slot: 'muted', anchor: 'end' }) +
    text({ x: width - 8, y: 29, s: r.ctxPct != null ? `ctx ${r.ctxPct}%` : 'ctx —', size: 11, slot, anchor: 'end' }))
}
