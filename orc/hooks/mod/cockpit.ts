// The /orc cockpit's data and view model: pure functions over orc-state's CLI
// output (`get`, `slice list`, `decision get`), so register.ts only binds `$`
// calls and draws. orc-state stays the single writer of .orc/.

export type Session = {
  command: string
  gitBranch: string
  description?: string | null
  status: string
  phase: number | 'done'
  phaseLabel?: string | null
  totalPhases: number
  jiraTicket?: string | null
}
export type Slice = { id: string; status: string; title: string; commit: string | null }
export type Decision = { key: string; value: string; provenance: string }
export type Snapshot = { session: Session | null; slices: Slice[]; decisions: Decision[] }

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
