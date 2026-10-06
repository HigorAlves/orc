// The /orc cockpit's data and view model: pure functions over orc-state's CLI
// output (`get`, `slice list`, `decision get`), so register.ts only binds `$`
// calls and draws. orc-state stays the single writer of .orc/.

import type {
  OrcAgentUsage, OrcCriterion, OrcDecision, OrcMeter, OrcQaReport, OrcSession, OrcSize, OrcSlice, OrcSnapshot,
} from '../../types'

export type Session = OrcSession
export type Slice = OrcSlice
export type Decision = OrcDecision
export type Criterion = OrcCriterion
export type QaReport = OrcQaReport
export type AgentUsage = OrcAgentUsage
export type Size = OrcSize
export type Meter = OrcMeter
export type Snapshot = OrcSnapshot

export const POLICIES = ['manual', 'guided', 'auto'] as const
export const EMPTY: Snapshot = { session: null, slices: [], decisions: [] }

export function parseSession(stdout: string): Session | null {
  try {
    const s = JSON.parse(stdout)
    return s && typeof s.command === 'string' ? s : null
  } catch {
    return null
  }
}

// `orc-state slice list`: id<TAB>status<TAB>title<TAB>commit|-
export function parseSlices(tsv: string): Slice[] {
  return tsv.split('\n').filter(Boolean).map(line => {
    const [id = '', status = '', title = '', commit = '-'] = line.split('\t')
    return { id, status, title, commit: commit === '-' ? null : commit }
  })
}

export function parseDecisions(json: string): Decision[] {
  try {
    const d = JSON.parse(json).decisions ?? {}
    return Object.keys(d).sort().map(key => ({ key, value: String(d[key].value), provenance: String(d[key].provenance) }))
  } catch {
    return []
  }
}

export const isDone = (s: Slice) => s.status === 'committed' || s.status === 'skipped'
export const policyOf = (snap: Snapshot) => snap.decisions.find(d => d.key === 'autopilotLevel')?.value

// One row per phase: ✓ done, ▶ current (with its label), · ahead.
export function phaseRows(s: Session): string[] {
  const current = s.phase === 'done' ? s.totalPhases + 1 : Number(s.phase)
  return Array.from({ length: s.totalPhases }, (_, i) => {
    const n = i + 1
    const mark = n < current ? '✓' : n === current ? '▶' : '·'
    return `${mark} ${n}${n === current && s.phaseLabel ? ' ' + s.phaseLabel : ''}`
  })
}

export function headline(snap: Snapshot): string {
  const s = snap.session
  if (!s) return 'No orc session on this branch — start one with /orc:flow or /orc:plan.'
  const phase = s.phase === 'done' ? 'done' : `${s.phase}/${s.totalPhases}${s.phaseLabel ? ' ' + s.phaseLabel : ''}`
  const slices = snap.slices.length ? `slices ${snap.slices.filter(isDone).length}/${snap.slices.length}` : ''
  const policy = policyOf(snap)
  return [`${s.command} ${phase}`, slices, s.jiraTicket ?? '', policy ? `policy ${policy}` : '', s.gitBranch]
    .filter(Boolean)
    .join(' · ')
}

export const sliceLine = (s: Slice) => `#${s.id} ${s.status.padEnd(9)} ${s.title}${s.commit ? '  ' + s.commit : ''}`

// The text answer where no pane can be drawn (VS Code, claude -p, a refused pane).
export function summaryText(snap: Snapshot): string {
  return [headline(snap), ...snap.slices.map(sliceLine)].join('\n')
}

// --- QA / PR / Agents tabs ---------------------------------------------------

export function parseReport(json: string): QaReport | null {
  try {
    const r = JSON.parse(json)
    return Array.isArray(r.acceptance) ? { verdict: String(r.verdict ?? ''), acceptance: r.acceptance, missing: r.missing ?? [] } : null
  } catch {
    return null
  }
}

const MARK: Record<string, string> = { pass: '✓', fail: '✗', skipped: '–' }
export const criterionLine = (c: Criterion) =>
  `${MARK[c.result] ?? '?'} ${c.criterion}  (slice ${c.sliceId})${c.note ? ' — ' + c.note : ''}`

export function parseSize(loc: string, budget: string): Size | null {
  const l = Number(loc.trim()), b = Number(budget.trim())
  return Number.isFinite(l) && Number.isFinite(b) && b > 0 && loc.trim() !== '' ? { loc: l, budget: b } : null
}

// A 20-cell bar: filled share of the budget, then the numbers.
export function sizeLine(s: Size): string {
  const filled = Math.min(20, Math.round((s.loc / s.budget) * 20))
  const over = s.loc - s.budget
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${s.loc}/${s.budget} LOC${over > 0 ? ` — over by ${over}` : ''}`
}

export function parseUsage(json: string): AgentUsage[] {
  try {
    const rows = JSON.parse(json)
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

const k = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))
export const usageLine = (u: AgentUsage) =>
  `${u.agent.replace(/^orc:/, '').padEnd(24)} ${String(u.runs).padStart(3)} run${u.runs === 1 ? ' ' : 's'}  ${k(u.in)} in / ${k(u.out)} out  ${Math.round(u.ms / 1000)}s`

// $.session.usage() → the header's context % and cost; null where the host has none.
export function parseMeter(u: { context?: { percent?: number }; cost?: { usd: number } } | null | undefined): Meter | null {
  if (!u) return null
  const pct = u.context?.percent
  return { contextPercent: typeof pct === 'number' ? Math.round(pct) : null, usd: u.cost ? Math.round(u.cost.usd * 100) / 100 : null }
}
