import type { Els } from '../pane'
import type { Radius } from './model'

const CELLS = 14
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// Budget-relative bar: filled share of the budget, a marker at the budget. Overflow reads in the words.
export function radiusBar(m: Radius): string {
  const filled = Math.min(CELLS, Math.round((m.loc / m.budget) * CELLS))
  return '▓'.repeat(filled) + '░'.repeat(CELLS - filled) + '│'
}

export function radiusLine(m: Radius): string {
  const over = m.loc - m.budget
  return [
    `LOC ${m.loc}/${m.budget} ${radiusBar(m)} ${over > 0 ? `over by ${over}` : `${-over} under`}`,
    plural(m.files, 'file'),
    ...(m.dependents != null ? [plural(m.dependents, 'dependent')] : []),
  ].join(' · ')
}

export const radiusText = (els: Els, m: Radius) =>
  els.Text({ color: m.loc > m.budget ? 'red' : undefined, children: [radiusLine(m)] })
