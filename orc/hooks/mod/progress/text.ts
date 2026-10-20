import type { ProgressModel } from './model'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

export const barWidth = (columns: number) => Math.max(7, Math.min(14, Math.floor(columns / 8)))

export function progressBar(m: Pick<ProgressModel, 'done' | 'running' | 'total'>, width: number): string {
  const total = Math.max(1, m.total)
  const d = Math.round((m.done / total) * width)
  const r = Math.min(width, Math.round(((m.done + m.running) / total) * width)) - d
  return '▓'.repeat(d) + '▒'.repeat(Math.max(0, r)) + '░'.repeat(Math.max(0, width - d - Math.max(0, r)))
}

export function progressText(m: ProgressModel, columns: number): string {
  const phase = `${CIRCLED[m.phase - 1] ?? m.phase}${m.phaseLabel ? ' ' + m.phaseLabel : ''}`
  const agents = m.agents > 0 ? `  ×${m.agents}` : ''
  return `orc · ${m.title} · ${phase}  ${progressBar(m, barWidth(columns))} ${m.done}/${m.total} · QA ${m.qa ?? '—'} · PR ${m.pr ?? '—'}${agents}`
}
