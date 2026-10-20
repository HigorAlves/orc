import type { GuardSummary } from './guard/measure'
import type { ProgressModel } from './progress/model'
import type { Els } from './pane'

// The one orc row above the prompt: every feature offers a row, the highest
// priority wins. Pure — register.ts draws it.
export type BandRow =
  | { kind: 'ci'; pr: number | string; failing: string[] }
  | { kind: 'guard'; summary: string; detail?: GuardSummary }
  | { kind: 'sentinel'; id: string; text: string }
  | { kind: 'retro'; id: string; rule: string; seen: number }
  | { kind: 'cache'; minutesLeft: number; rewriteUsd: number | null; tokens: number; waitingOn: string | null }
  | { kind: 'progress'; model: ProgressModel; replay?: boolean }

export const PRIORITY: BandRow['kind'][] = ['guard', 'ci', 'sentinel', 'retro', 'cache', 'progress']

export function pickBand(rows: (BandRow | null | undefined)[]): BandRow | null {
  const present = rows.filter((r): r is BandRow => !!r)
  for (const kind of PRIORITY) {
    const row = present.find(r => r.kind === kind)
    if (row) return row
  }
  return null
}

// One terminal band line: the text truncates at the end and the buttons never
// shrink, so a docked pane's narrow body never wraps the row or cuts a label.
export function bandLine(els: Els, text: string, color: string | undefined, buttons: unknown[]) {
  const { Box, Text } = els
  // paddingRight keeps the buttons clear of the engine's own band control at the right edge.
  return Box({ flexDirection: 'row', columnGap: 2, paddingRight: 4, children: [
    Box({ flexShrink: 1, minWidth: 0, children: [Text({ wrap: 'truncate-end', ...(color ? { color } : {}), children: [text] })] }),
    Box({ flexShrink: 0, flexDirection: 'row', columnGap: 2, children: buttons as never }),
  ] })
}
