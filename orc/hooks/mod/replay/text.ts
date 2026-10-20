// Terminal drawing of one replay step: pure, takes the resolved element table.
import type { Els } from '../pane'
import type { ReplayViewModel } from './model'

export function replayText(els: Els, v: ReplayViewModel) {
  const { Box, Text } = els
  const Code = 'Code' in els ? els.Code : null
  const pills = Array.from({ length: v.steps }, (_, i) => (i === v.step ? `[${i + 1}]` : ` ${i + 1} `)).join('')
  const body = v.diff
    ? Code ? Code({ source: v.diff, format: 'diff', wrap: 'truncate-end' }) : Text({ children: v.diff })
    : Text({ dimColor: true, children: '(no line changes)' })
  return Box({
    flexDirection: 'column',
    children: [
      Text({ key: 'h', bold: true, children: `Slice ${v.sliceId} (${v.sliceIdx + 1}/${v.sliceCount}) · ${v.tool} ${v.path}` }),
      Text({ key: 'p', dimColor: true, children: `${pills}  +${v.add} -${v.del}` }),
      body,
    ],
  })
}
