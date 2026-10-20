// Pure progress model: snapshot + usage ledger -> what the band and cockpit draw.
import { isDone, type Snapshot } from '../cockpit'

// Structural twins of OrcLedgerEntry / OrcLedger (types/index.d.ts) so this file stays standalone.
export type LedgerEntryLike = {
  requests: number; input: number; output: number; cacheRead: number; cacheWrite: number
  lastAt: number | null; lastContext: number; model: string | null; ms: number
  type: string | null; step: { label: string; n: number; of: number } | null; startedAt: number | null
}
export type LedgerLike = { main: LedgerEntryLike; agents: Record<string, LedgerEntryLike> }
export type UsageLike = { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
export type CostOf = (usage: UsageLike, model: string) => number | null

export type ProgressModel = {
  title: string; phase: number; phaseLabel: string | null; totalPhases: number
  done: number; running: number; total: number
  qa: 'pass' | 'fail' | 'partial' | null; pr: number | string | null; agents: number; next: string | null
}

const CONTEXT_WINDOW = 200_000
const LIVE_MS = 30_000

const titleOf = (branch: string) => branch.replace(/^(feat|fix|chore|refactor|docs|test|perf)[-/]/, '')
const qaOf = (v: string | undefined): ProgressModel['qa'] => (v === 'pass' || v === 'fail' || v === 'partial' ? v : null)

export function progressModel(snap: Snapshot, ledger: LedgerLike): ProgressModel | null {
  const s = snap.session
  if (!s || s.phase === 'done') return null
  const total = snap.slices.length
  const done = snap.slices.filter(isDone).length
  const running = snap.slices.filter(x => x.status === 'red' || x.status === 'green').length
  const qa = qaOf(snap.qa?.verdict)
  const pr = s.linkedPRs?.[0]?.number ?? null
  const next = s.phase === 5 && total > 0 && done === total ? '/orc:qa' : qa === 'pass' ? '/orc:ship' : '/orc:resume'
  return {
    title: titleOf(s.branch), phase: s.phase, phaseLabel: s.phaseLabel ?? null, totalPhases: s.totalPhases,
    done, running, total, qa, pr, agents: Object.keys(ledger.agents).length, next,
  }
}

export type AgentRow = {
  name: string; slice: string | null; step: string; ctxPct: number | null; usd: number | null; elapsed: string; running: boolean
}

const elapsedOf = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`
}

export function agentRows(ledger: LedgerLike, costOf: CostOf, now: number): AgentRow[] {
  return Object.entries(ledger.agents)
    .map(([name, e]) => {
      const usage = e.model && {
        model: e.model, input_tokens: e.input, output_tokens: e.output,
        cache_read_input_tokens: e.cacheRead, cache_creation_input_tokens: e.cacheWrite,
      }
      return {
        name, slice: null, step: e.step ? `${e.step.label} ${e.step.n}/${e.step.of}` : '',
        ctxPct: e.lastContext > 0 ? Math.round((e.lastContext / CONTEXT_WINDOW) * 100) : null,
        usd: usage && e.model ? costOf(usage, e.model) : null,
        elapsed: elapsedOf((e.lastAt ?? now) - (e.startedAt ?? e.lastAt ?? now)),
        running: e.lastAt != null && now - e.lastAt < LIVE_MS,
        startedAt: e.startedAt ?? 0,
      }
    })
    .sort((a, b) => Number(b.running) - Number(a.running) || a.startedAt - b.startedAt)
    .map(({ startedAt: _s, ...row }) => row)
}

export const agentRowLine = (r: AgentRow) =>
  [r.ctxPct != null ? `ctx ${r.ctxPct}%` : 'ctx —', r.usd != null ? `$${r.usd.toFixed(2)}` : '$—', r.elapsed].join(' · ')
