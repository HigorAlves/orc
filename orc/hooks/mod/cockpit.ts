// The /orc cockpit's data and view model: pure functions over orc-state's CLI
// output (`get`, `slice list`, `decision get`), so register.ts only binds `$`
// calls and draws. orc-state stays the single writer of .orc/.

import type {
  OrcAgentUsage, OrcCriterion, OrcDecision, OrcMeter, OrcQaReport, OrcSession, OrcSize, OrcSlice, OrcSnapshot,
} from '../../types'
import type { Profile } from './profiles'

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

export type Cell = { text: string; bold?: boolean; dim?: boolean; color?: string }

// Model profile in force: the branch's settled decision, else the userConfig value.
export const profileOf = (snap: Snapshot, fallback: Profile): Profile => {
  const d = snap.decisions.find(d => d.key === 'modelProfile')?.value
  return d === 'quality' || d === 'economy' || d === 'balanced' ? d : fallback
}

// The header strip: one cell per fact, wrapping as the width allows.
export function headerCells(snap: Snapshot, profile: Profile): Cell[] {
  const s = snap.session
  if (!s) return [{ text: 'No orc session on this branch — /orc:flow or /orc:plan starts one.', dim: true }]
  const phase = s.phase === 'done' ? 'done' : `${s.phase}/${s.totalPhases}${s.phaseLabel ? ' ' + s.phaseLabel : ''}`
  const cells: Cell[] = [{ text: `${s.command} ${phase}`, bold: true }]
  if (snap.slices.length) cells.push({ text: `slices ${snap.slices.filter(isDone).length}/${snap.slices.length}` })
  cells.push({ text: `policy ${policyOf(snap) ?? 'manual'}` }, { text: `profile ${profile}` })
  const m = snap.meter
  if (m?.contextPercent != null) cells.push({ text: `ctx ${m.contextPercent}%`, color: m.contextPercent >= 85 ? 'red' : m.contextPercent >= 70 ? 'yellow' : undefined })
  if (m?.usd != null) cells.push({ text: `$${m.usd.toFixed(2)}` })
  if (s.jiraTicket) cells.push({ text: s.jiraTicket })
  cells.push({ text: s.gitBranch, dim: true })
  return cells
}

// Ladder beside ledger when there is room for both (28 + 2 + ~42 columns); else stacked.
export const layoutFor = (placement: 'dock' | 'inline', bodyColumns: number): 'row' | 'column' =>
  bodyColumns >= 72 || (placement === 'dock' && bodyColumns >= 64) ? 'row' : 'column'

export type SectionId = 'qa' | 'pr' | 'agents' | 'decisions' | 'digest' | 'diff'

// Which sections need a look: a failing QA verdict, an over-budget diff or red CI.
export function attention(snap: Snapshot, ciRed: boolean): Set<SectionId> {
  const out = new Set<SectionId>()
  if (snap.qa && snap.qa.verdict !== 'pass') out.add('qa')
  if ((snap.size && snap.size.loc > snap.size.budget) || ciRed) out.add('pr')
  return out
}

export const sectionLabel = (id: SectionId, open: boolean, flagged: boolean) =>
  `${open ? '▾' : '▸'} ${({ qa: 'QA', pr: 'PR', agents: 'Agents', decisions: 'Decisions', digest: 'Digest', diff: 'Diff' })[id]}${flagged ? ' !' : ''}`

// The '## Resume digest' section of checkpoint.md, or null when there is none.
export function digestOf(markdown: string): string | null {
  const m = /^## Resume digest[^\S\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(markdown)
  const text = m?.[1]?.trim() ?? ''
  return text ? text : null
}

// A unified diff bounded for a Code leaf: cut at the last file boundary under max.
export function cutDiff(text: string, max = 8000): { source: string; truncated: boolean } {
  if (text.length <= max) return { source: text, truncated: false }
  const at = text.lastIndexOf('\ndiff --git', max)
  return { source: at > 0 ? text.slice(0, at + 1) : text.slice(0, text.indexOf('\n', max) + 1 || max), truncated: true }
}

export const currentSlice = (slices: Slice[]): Slice | null => slices.find(x => !isDone(x)) ?? null

export const phaseShort = (s: Session) =>
  `${s.command} ${s.phase === 'done' ? 'done' : `${s.phase}/${s.totalPhases}`}${s.phaseLabel && s.phase !== 'done' ? ' ' + s.phaseLabel : ''}`
export const spinnerSuffix = (snap: Snapshot, agent: string | null) =>
  snap.session ? ` · orc ${phaseShort(snap.session)}${agent ? ' · ' + agent.replace(/^orc-/, '') : ''}` : ''
export const hintFor = (snap: Snapshot) => (snap.session ? `orc ${phaseShort(snap.session)} · /orc cockpit · /orc:resume` : null)

const PLUMBING = /^\s*(?:\S*\/)?(?:orc-state|orc-pr-size|orc-report|orc-docker-env|orc-workspace-detect)\b|^\s*gh pr checks\b/
// One dim line for orc's own CLI calls; null for anything else (the engine draws it).
export function plumbingLine(input: unknown, isRunning: boolean): string | null {
  const command = (input as { command?: unknown })?.command
  if (typeof command !== 'string' || !PLUMBING.test(command)) return null
  const first = command.split('\n')[0]?.trim() ?? ''
  return `○ orc · ${first.length > 100 ? first.slice(0, 99) + '…' : first}${isRunning ? ' …' : ''}`
}
