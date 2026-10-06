// orc's plugin contract: the shapes the mod keeps in `$.state`, declared so
// `$.state.get/set({ plugin: 'orc', key })` type-check. No imports here (contract rule).

export type OrcSession = {
  command: string
  branch: string
  gitBranch: string
  description?: string | null
  status: string
  phase: number | 'done'
  phaseLabel?: string | null
  totalPhases: number
  jiraTicket?: string | null
  linkedPRs?: { url?: string; number?: number; repo?: string }[]
}
export type OrcSlice = { id: string; status: string; title: string; commit: string | null }
export type OrcDecision = { key: string; value: string; provenance: string }
export type OrcCriterion = { criterion: string; result: string; note: string; sliceId: number | string }
export type OrcQaReport = { verdict: string; acceptance: OrcCriterion[]; missing: string[] }
export type OrcAgentUsage = { agent: string; runs: number; in: number; out: number; ms: number }
export type OrcSize = { loc: number; budget: number }
export type OrcMeter = { contextPercent: number | null; usd: number | null }
export type OrcSnapshot = {
  session: OrcSession | null
  slices: OrcSlice[]
  decisions: OrcDecision[]
  qa?: OrcQaReport | null
  size?: OrcSize | null
  usage?: OrcAgentUsage[]
  meter?: OrcMeter | null
}
export type OrcSections = { qa: boolean; pr: boolean; agents: boolean; decisions: boolean; digest: boolean; diff: boolean }
export type OrcLive = { agent: string | null; since: number | null }
export type OrcDetails = { digest: string | null; diff: string | null; diffTruncated: boolean }

declare module 'claude-code' {
  interface PluginState {
    orc: {
      snapshot: OrcSnapshot
      sections: OrcSections
      live: OrcLive
      details: OrcDetails
    }
  }
}
