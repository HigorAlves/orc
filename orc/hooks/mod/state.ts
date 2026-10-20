// The cockpit's data in $.state: the initial values of the `orc` keys the
// contract (types/index.d.ts) declares. Pure — the engine follows `$` only
// inside register.ts and wants state refs written as literals there, so the
// refs, the loader and the triggers all live in register.ts.
import type { OrcDetails, OrcLive, OrcRadius, OrcSections } from '../../types'
import type { CiSummary } from './ci'
import type { GuardSummary } from './guard/measure'
import type { ReplayState } from './replay/model'
import type { CandidateFile } from './retro/store'
export { LEDGER_INITIAL } from './ledger'

export const SECTIONS_INITIAL: OrcSections = { qa: false, pr: false, agents: false, decisions: false, digest: false, diff: false, touched: false, radius: false }
export const RADIUS_INITIAL: OrcRadius | null = null
export const LIVE_INITIAL: OrcLive = { agent: null, since: null }
export const DETAILS_INITIAL: OrcDetails = { digest: null, diff: null, diffTruncated: false, shots: null }

// The red-CI alert lives in module scope (the watcher runs on a timer, outside
// any event); the band and the PR section read it and ui.invalidate redraws.
export type CiAlert = { pr: number | string; summary: CiSummary } | null
export const ciBox: { alert: CiAlert } = { alert: null }

// The measured guard card lives only while the shell floor's confirm dialog is pending.
export const guardBox: { current: { summary: GuardSummary; lines: string[] } | null } = { current: null }

// orc-state verbs that change what the cockpit shows. Reads (get, list, line…) never refresh.
const WRITE = /(^|[\s;&|/])orc-state["']?\s+(init|phase|status|link-pr|digest|checkpoint|usage\s+add|slice\s+(init|set)|jira|decision\s+set|migrate)\b/
export const isOrcStateWrite = (command: string) => WRITE.test(command)

// Replay navigation: Next/Prev walk the steps of a slice, then cross into the neighbouring slice.
export function stepReplay(state: ReplayState, delta: 1 | -1): ReplayState['view'] {
  const ids = [...new Set(state.edits.map(x => x.sliceId))]
  if (!ids.length) return state.view
  const { slice, step } = state.view
  const at = Math.max(0, Math.min(slice, ids.length - 1))
  const steps = state.edits.filter(x => x.sliceId === ids[at]).length
  const cur = Math.max(0, Math.min(step, steps - 1))
  if (delta === 1) return cur + 1 < steps ? { slice: at, step: cur + 1 } : at + 1 < ids.length ? { slice: at + 1, step: 0 } : { slice: at, step: cur }
  if (cur > 0) return { slice: at, step: cur - 1 }
  if (at === 0) return { slice: 0, step: 0 }
  return { slice: at - 1, step: state.edits.filter(x => x.sliceId === ids[at - 1]).length - 1 }
}

// `/orc replay` opens at the latest slice, first step.
export const latestReplayView = (state: ReplayState): ReplayState['view'] =>
  ({ slice: Math.max(0, new Set(state.edits.map(x => x.sliceId)).size - 1), step: 0 })

// Keep-warm lives in module scope: timers are not events. `gen` bumps on every arm/stop so a ping that
// lands after either is discarded; `pingedAt` is when the last successful ping refreshed the cache.
export const warmBox: { gen: number; timer: { cancel(): void } | null; deadline: number | null; pingedAt: number | null } =
  { gen: 0, timer: null, deadline: null, pingedAt: null }

// True while an AskUserQuestion dialog is on screen (set by its tool.call hook before the dialog, cleared when the call ends).
export const askBox: { open: boolean } = { open: false }

// Corrections -> retro store, module scope (writes happen from deferred work, not events): the resolved retro dir,
// the cached candidates, the last assistant answer (context for the check), and the write chain.
export const retroBox: { dir: string | null; file: CandidateFile | null; prev: string; chain: Promise<unknown> } =
  { dir: null, file: null, prev: '', chain: Promise.resolve() }

// The sentinel's card, module scope: model-free checks fill `check`, the Haiku review fills `model`, the row shows
// `check ?? model`. `learn` is the expanded text of the card with that id; `steps` counts an orc agent's requests.
export type SentinelCard = { id: string; text: string; slice: string }
export const sentinelBox: { check: SentinelCard | null; model: SentinelCard | null; learn: { id: string; text: string } | null; inflight: boolean; steps: Map<string, number>; history: { command: string; ok: boolean }[] } =
  { check: null, model: null, learn: null, inflight: false, steps: new Map(), history: [] }
