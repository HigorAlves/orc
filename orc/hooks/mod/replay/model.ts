// Replay recorder: every successful edit is kept as a pre-rendered unified
// diff, grouped by slice. Pure; register.ts owns the state key.
import { unifiedDiff } from './diff'

export const PER_SLICE_CAP = 60
export const TOTAL_CAP = 300

export type ReplayEdit = { sliceId: number; path: string; tool: string; diff: string; add: number; del: number; at: number }
export type ReplayState = { edits: ReplayEdit[]; view: { slice: number; step: number } }
export const REPLAY_INITIAL: ReplayState = { edits: [], view: { slice: 0, step: 0 } }

export type EditInput = { sliceId: number; path: string; tool: string; old: string; new: string; at: number }

// Slice 0 holds edits made with no slice in progress (QA fixes, or no orc session).
export const sliceLabel = (id: number) => (id === 0 ? 'Outside slices' : `Slice ${id}`)

export function recordEdit(state: ReplayState, e: EditInput): ReplayState {
  const { text: diff, add, del } = unifiedDiff(e.old, e.new, e.path)
  const next: ReplayEdit = { sliceId: e.sliceId, path: e.path, tool: e.tool, diff, add, del, at: e.at }
  let edits = [...state.edits, next]
  // Per-slice cap: drop that slice's oldest edits.
  let over = edits.filter(x => x.sliceId === e.sliceId).length - PER_SLICE_CAP
  if (over > 0) edits = edits.filter(x => x.sliceId !== e.sliceId || over-- <= 0)
  // Total cap: drop whole slices, oldest first, never the one being recorded.
  while (edits.length > TOTAL_CAP) {
    const oldest = edits[0].sliceId
    if (oldest === e.sliceId) break
    edits = edits.filter(x => x.sliceId !== oldest)
  }
  return { ...state, edits }
}

export type ReplayViewModel = {
  sliceIdx: number; sliceCount: number; sliceId: number; step: number; steps: number
  path: string; tool: string; add: number; del: number; diff: string
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max))

// `slice` and `step` are 0-based indexes (slices in first-recorded order); both clamp.
export function replayView(state: ReplayState, at: { slice: number; step: number }): ReplayViewModel | null {
  if (!state.edits.length) return null
  const ids = [...new Set(state.edits.map(x => x.sliceId))]
  const sliceIdx = clamp(at.slice, ids.length - 1)
  const sliceEdits = state.edits.filter(x => x.sliceId === ids[sliceIdx])
  const step = clamp(at.step, sliceEdits.length - 1)
  const { path, tool, add, del, diff } = sliceEdits[step]
  return { sliceIdx, sliceCount: ids.length, sliceId: ids[sliceIdx], step, steps: sliceEdits.length, path, tool, add, del, diff }
}
