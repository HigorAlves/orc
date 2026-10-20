import type { Els } from '../pane'
import type { TouchedRow } from './model'

export const SHOWN = 15

export const touchedLine = (r: TouchedRow) =>
  `● ${r.path}${r.add != null && r.del != null ? ` +${r.add} −${r.del}` : ''} ${r.kind} ${r.age}`

export function touchedText(els: Els, rows: TouchedRow[]) {
  const color = { read: undefined, edit: 'yellow', committed: 'green' } as const
  return [
    ...rows.slice(0, SHOWN).map(r => els.Text({ color: color[r.kind], dimColor: r.kind === 'read', children: [touchedLine(r)] })),
    ...(rows.length > SHOWN ? [els.Text({ dimColor: true, children: [`… ${rows.length - SHOWN} more`] })] : []),
  ]
}
