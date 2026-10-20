// Terminal drawing of the cache band row: pure, takes the resolved element table.
import type { BandRow } from '../band'
import type { Els } from '../pane'

export type CacheRow = Extract<BandRow, { kind: 'cache' }>

export const cacheLine = (r: CacheRow): string =>
  `cache cools in ${r.minutesLeft} min · re-write ~${Math.round(r.tokens / 1000)}k tok${r.rewriteUsd != null ? ` ≈ $${r.rewriteUsd.toFixed(2)}` : ''}` +
  (r.waitingOn ? ` · waiting on ${r.waitingOn}` : '')

export const cacheAlt = cacheLine

// `warm` is the Keep warm action; null when keep-warm is already armed.
export function cacheText(els: Els, r: CacheRow, warm: (() => void) | null) {
  const { Box, Text, Button } = els
  return Box({ flexDirection: 'row', columnGap: 2, children: [
    Text({ color: 'yellow', children: ['⏳ ' + cacheLine(r)] }),
    ...(warm ? [Button({ key: 'cache-warm', label: 'Keep warm', onPress: warm })] : []),
  ] })
}
