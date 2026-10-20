import type { ProgressModel } from './progress/model'

// The one orc row above the prompt: every feature offers a row, the highest
// priority wins. Pure — register.ts draws it.
export type BandRow =
  | { kind: 'ci'; pr: number | string; failing: string[] }
  | { kind: 'guard'; summary: string }
  | { kind: 'sentinel'; id: string; text: string }
  | { kind: 'retro'; id: string; rule: string; seen: number }
  | { kind: 'cache'; minutesLeft: number; rewriteUsd: number | null; tokens: number; waitingOn: string | null }
  | { kind: 'progress'; model: ProgressModel }

export const PRIORITY: BandRow['kind'][] = ['ci', 'guard', 'sentinel', 'retro', 'cache', 'progress']

export function pickBand(rows: (BandRow | null | undefined)[]): BandRow | null {
  const present = rows.filter((r): r is BandRow => !!r)
  for (const kind of PRIORITY) {
    const row = present.find(r => r.kind === kind)
    if (row) return row
  }
  return null
}
