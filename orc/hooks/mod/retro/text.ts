// Terminal drawing of the retro band row: pure, takes the resolved element table.
import type { BandRow } from '../band'
import type { Els } from '../pane'
import { bandLine } from '../band'

export type RetroRow = Extract<BandRow, { kind: 'retro' }>
export type RetroActions = { save: () => void; edit: () => void; skip: () => void }

export const retroLine = (r: RetroRow): string => `✎ retro "${r.rule}" · seen ${r.seen}×`
export const retroAlt = retroLine

export function retroText(els: Els, r: RetroRow, a: RetroActions) {
  return bandLine(els, retroLine(r), 'cyan', retroButtons(els, a))
}

// The same three buttons beside the terminal line or the desktop card.
export const retroButtons = (els: Els, a: RetroActions) => [
  els.Button({ key: 'retro-save', variant: 'primary', hotkey: 's', label: 'Save rule', onPress: a.save }),
  els.Button({ key: 'retro-edit', hotkey: 'e', label: 'Edit', onPress: a.edit }),
  els.Button({ key: 'retro-skip', hotkey: 'k', label: 'Skip', onPress: a.skip }),
]
