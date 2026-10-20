export type SentinelKind = 'untested' | 'drift' | 'risk'
export type SentinelVerdict = { headsUp: string | null; kind: SentinelKind | null }
export type SentinelSlice = { id: number | string; title?: string; touchpoints: string[]; acceptance: string[] }

export const DIFF_CAP = 6000
const KINDS: readonly string[] = ['untested', 'drift', 'risk']

export function sentinelPrompt(slice: SentinelSlice, diff: string): string {
  return [
    `You watch an implementer working on slice ${slice.id}${slice.title ? ` (${slice.title})` : ''}.`,
    `Planned files: ${slice.touchpoints.join(', ') || 'none listed'}`,
    `Acceptance:\n${slice.acceptance.map(a => '- ' + a).join('\n') || '- none listed'}`,
    `Diff so far (may be cut):\n${diff.slice(0, DIFF_CAP)}`,
    'Raise at most one short heads-up: changed behavior without a test ("untested"), work drifting from the acceptance or files ("drift"), or a correctness/security risk ("risk"). Say nothing when all is fine.',
    'Reply with JSON only: {"headsUp": string|null, "kind": "untested"|"drift"|"risk"|null}',
  ].join('\n\n')
}

export function parseSentinel(raw: string): SentinelVerdict | null {
  let v: unknown
  // Models often fence JSON even when told not to.
  try { v = JSON.parse(raw.trim().replace(/^```[a-z]*\s*|\s*```$/gi, '')) } catch { return null }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (!('headsUp' in o) || !('kind' in o)) return null
  if (o.headsUp !== null && typeof o.headsUp !== 'string') return null
  if (o.kind !== null && !(typeof o.kind === 'string' && KINDS.includes(o.kind))) return null
  return { headsUp: o.headsUp, kind: o.kind as SentinelKind | null }
}
