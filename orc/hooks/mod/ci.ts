// CI watcher logic: summarize `gh pr checks --json name,bucket`, decide when a
// change deserves an alert, and share one poller across sessions through a
// lease in $.store (every session on the machine shares it).

export type CiState = 'pass' | 'fail' | 'pending' | 'none'
export type CiSummary = { state: CiState; failing: string[]; pending: number; total: number }
export type Lease = { sid: string; until: number }
export type CiRecord = { lease?: Lease; summary?: CiSummary; checkedAt?: number; notified?: string }

export const POLL_MS = 60_000
export const LEASE_MS = 90_000
export const SETTLED_MS = 300_000 // a settled PR is re-checked every 5 minutes (a new push restarts CI)

export function summarizeChecks(json: string): CiSummary {
  let rows: { name?: string; bucket?: string }[] = []
  try {
    rows = JSON.parse(json)
  } catch {
    return { state: 'none', failing: [], pending: 0, total: 0 }
  }
  if (!Array.isArray(rows) || rows.length === 0) return { state: 'none', failing: [], pending: 0, total: 0 }
  const failing = rows.filter(r => r.bucket === 'fail' || r.bucket === 'cancel').map(r => String(r.name)).sort()
  const pending = rows.filter(r => r.bucket === 'pending').length
  const state: CiState = failing.length ? 'fail' : pending ? 'pending' : 'pass'
  return { state, failing, pending, total: rows.length }
}

export const signature = (s: CiSummary) => s.state + ':' + s.failing.join(',')

// Another live session holds the lease: read its result instead of polling.
export const mayPoll = (lease: Lease | undefined, sid: string, now: number) => !lease || lease.sid === sid || lease.until < now

// Red: failing now, with a failure set not yet alerted. Green: passing after we saw it not pass.
export function alertFor(prev: CiSummary | undefined, next: CiSummary, notified?: string): 'red' | 'green' | null {
  if (next.state === 'fail' && notified !== signature(next)) return 'red'
  if (next.state === 'pass' && prev && prev.state !== 'pass' && notified !== signature(next)) return 'green'
  return null
}

export function statusLine(pr: number | string, s: CiSummary): string {
  if (s.state === 'fail') return `CI #${pr}: ${s.failing.length} failing (${s.failing.join(', ')})`
  if (s.state === 'pending') return `CI #${pr}: running (${s.pending}/${s.total} pending)`
  if (s.state === 'pass') return `CI #${pr}: green`
  return `CI #${pr}: no checks`
}
