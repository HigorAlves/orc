import type { GuardSummary } from './measure'

// At most 4 notice lines: headline, change stat, then the items on one line.
export function guardText(s: GuardSummary): string[] {
  const out = [s.headline]
  if (s.add != null || s.del != null) out.push(`+${s.add ?? 0} -${s.del ?? 0}`)
  if (s.items.length > 0) out.push(s.items.slice(0, 5).join(', ') + (s.total > 5 ? ` (+${s.total - 5} more)` : ''))
  return out.slice(0, 4)
}
