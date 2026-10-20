// Usage ledger reducer: what each request cost in tokens, kept per main loop and
// per subagent. Pure — register.ts owns the $.state reads and writes.
import type { OrcLedger, OrcLedgerEntry } from '../../types'

export type StepUsage = { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

export const ENTRY_INITIAL: OrcLedgerEntry = { requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, lastAt: null, lastContext: 0, model: null, ms: 0, type: null, step: null, startedAt: null, finishedAt: null }
export const LEDGER_INITIAL: OrcLedger = { main: ENTRY_INITIAL, agents: {} }

export function recordStep(l: OrcLedger, s: { agentId: string | null; usage: StepUsage | null; at: number; ms: number }): OrcLedger {
  const prev = s.agentId ? l.agents[s.agentId] ?? ENTRY_INITIAL : l.main
  const u = s.usage
  const next: OrcLedgerEntry = {
    ...prev, requests: prev.requests + 1, ms: prev.ms + Math.max(0, s.ms), lastAt: s.at, startedAt: prev.startedAt ?? s.at,
    input: prev.input + (u?.input_tokens ?? 0), output: prev.output + (u?.output_tokens ?? 0),
    cacheRead: prev.cacheRead + (u?.cache_read_input_tokens ?? 0), cacheWrite: prev.cacheWrite + (u?.cache_creation_input_tokens ?? 0),
    lastContext: u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : prev.lastContext, model: u?.model ?? prev.model,
  }
  return s.agentId ? { ...l, agents: { ...l.agents, [s.agentId]: next } } : { ...l, main: next }
}

export const tagAgent = (l: OrcLedger, agentId: string, type: string): OrcLedger =>
  ({ ...l, agents: { ...l.agents, [agentId]: { ...(l.agents[agentId] ?? ENTRY_INITIAL), type } } })

export const dropAgent = (l: OrcLedger, agentId: string): OrcLedger => {
  const { [agentId]: _, ...rest } = l.agents
  return { ...l, agents: rest }
}

export const setStep = (l: OrcLedger, agentId: string, step: { label: string; n: number; of: number }): OrcLedger =>
  ({ ...l, agents: { ...l.agents, [agentId]: { ...(l.agents[agentId] ?? ENTRY_INITIAL), step } } })

// A finished agent keeps its row until the next main turn; an unknown id changes nothing.
export const finishAgent = (l: OrcLedger, agentId: string, at: number): OrcLedger =>
  l.agents[agentId] ? { ...l, agents: { ...l.agents, [agentId]: { ...l.agents[agentId], finishedAt: at } } } : l
