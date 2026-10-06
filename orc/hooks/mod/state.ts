// The cockpit's data in $.state: the initial values of the `orc` keys the
// contract (types/index.d.ts) declares. Pure — the engine follows `$` only
// inside register.ts and wants state refs written as literals there, so the
// refs, the loader and the triggers all live in register.ts.
import type { OrcDetails, OrcLive, OrcSections } from '../../types'
import type { CiSummary } from './ci'

export const SECTIONS_INITIAL: OrcSections = { qa: false, pr: false, agents: false, decisions: false, digest: false, diff: false }
export const LIVE_INITIAL: OrcLive = { agent: null, since: null }
export const DETAILS_INITIAL: OrcDetails = { digest: null, diff: null, diffTruncated: false }

// The red-CI alert lives in module scope (the watcher runs on a timer, outside
// any event); the band and the PR section read it and ui.invalidate redraws.
export type CiAlert = { pr: number | string; summary: CiSummary } | null
export const ciBox: { alert: CiAlert } = { alert: null }

// orc-state verbs that change what the cockpit shows. Reads (get, list, line…) never refresh.
const WRITE = /(^|[\s;&|/])orc-state["']?\s+(init|phase|status|link-pr|digest|checkpoint|usage\s+add|slice\s+(init|set)|jira|decision\s+set|migrate)\b/
export const isOrcStateWrite = (command: string) => WRITE.test(command)
