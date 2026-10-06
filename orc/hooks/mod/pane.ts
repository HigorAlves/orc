// The /orc cockpit's drawing: pure. register.ts owns every `$` call (the
// engine's scan follows `$` only inside that file), builds the callbacks, and
// hands this module the element table, the data and the actions.
import type { EngineInterface } from 'claude-code'
import { headerCells, isDone, layoutFor, phaseRows, sliceLine, type Snapshot } from './cockpit'
import type { Profile } from './profiles'

export const PANE = 'orc-cockpit'

export type Els = ReturnType<EngineInterface['ui']['resolve']>
export type PaneModel = {
  snap: Snapshot
  profile: Profile
  placement: 'dock' | 'inline'
  bodyColumns: number
}
export type PaneActions = { resume: () => void }

export function drawPane(els: Els, model: PaneModel, actions: PaneActions) {
  const { Box, Text, Button } = els
  const { snap } = model
  const s = snap.session
  const line = (text: string, style: { bold?: boolean; dimColor?: boolean; color?: string } = {}) => Text({ ...style, children: [text] })

  const header = Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children:
    headerCells(snap, model.profile).map(c => line(c.text, { bold: c.bold, dimColor: c.dim, color: c.color })) })

  const ladder = s
    ? Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, width: 28, children: [
        line('Phases', { bold: true }),
        ...phaseRows(s).map(r => line(r, r.startsWith('▶') ? { bold: true, color: 'cyan' } : r.startsWith('✓') ? { color: 'green' } : { dimColor: true })),
      ] })
    : null
  const ledger = Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, flexGrow: 1, children: [
    line('Slices', { bold: true }),
    ...(snap.slices.length
      ? snap.slices.map(x => line(sliceLine(x), { color: isDone(x) ? 'green' : x.status === 'pending' ? undefined : 'red' }))
      : [line('No slice ledger yet — /orc:plan writes one.', { dimColor: true })]),
  ] })
  const body = Box({ flexDirection: layoutFor(model.placement, model.bodyColumns), columnGap: 1, children: [...(ladder ? [ladder] : []), ledger] })

  const footer = Box({ flexDirection: 'row', columnGap: 2, children: [
    Button({ key: 'resume', variant: 'primary', label: s ? 'Resume (/orc:resume)' : 'New flow (/orc:flow)', hotkey: 'r', onPress: actions.resume }),
  ] })

  return Box({ flexDirection: 'column', rowGap: 1, children: [header, body, footer] })
}
