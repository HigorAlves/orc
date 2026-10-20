// Touched files: what the session read, edited and committed during the current
// slice. Pure — register.ts owns the $.state key and the tool.call hooks.
export type TouchKind = 'read' | 'edit' | 'committed'
export type TouchedFile = { path: string; kind: TouchKind; at: number; add: number | null; del: number | null }
export type Touched = { sliceId: string | null; files: TouchedFile[]; stamp: string }

export const TOUCHED_INITIAL: Touched = { sliceId: null, files: [], stamp: '' }
export const MAX_FILES = 40

const RANK: Record<TouchKind, number> = { read: 0, edit: 1, committed: 2 }

// Repo-relative when the path sits under the root; untouched otherwise.
export const relPath = (path: string, root: string): string =>
  root && path.startsWith(root.replace(/\/$/, '') + '/') ? path.slice(root.replace(/\/$/, '').length + 1) : path

// A new slice starts a fresh list; a file keeps its highest kind (committed > edit > read).
export function touch(t: Touched, x: { sliceId: string; path: string; kind: TouchKind; at: number }): Touched {
  const base = t.sliceId === x.sliceId ? t.files : []
  const prev = base.find(f => f.path === x.path)
  const entry: TouchedFile = prev
    ? { ...prev, kind: RANK[x.kind] > RANK[prev.kind] ? x.kind : prev.kind, at: x.at }
    : { path: x.path, kind: x.kind, at: x.at, add: null, del: null }
  const files = [...base.filter(f => f.path !== x.path), entry].slice(-MAX_FILES)
  return { ...t, sliceId: x.sliceId, files }
}

// `git commit` landed: the slice's edited files are committed now.
export const markCommitted = (t: Touched, at: number): Touched =>
  ({ ...t, files: t.files.map(f => (f.kind === 'edit' ? { ...f, kind: 'committed' as const, at } : f)) })

// `git diff --numstat` lines -> path -> counts ('-' = binary, no counts).
export function parseNumstat(out: string): Map<string, { add: number; del: number }> {
  const map = new Map<string, { add: number; del: number }>()
  for (const line of out.split('\n')) {
    const m = /^(\d+)\t(\d+)\t(.+)$/.exec(line)
    if (m) map.set(m[3], { add: Number(m[1]), del: Number(m[2]) })
  }
  return map
}

export const applyNumstat = (t: Touched, counts: Map<string, { add: number; del: number }>, stamp: string): Touched =>
  ({ ...t, stamp, files: t.files.map(f => { const c = counts.get(f.path); return c ? { ...f, add: c.add, del: c.del } : f }) })

export type TouchedRow = { path: string; kind: TouchKind; add: number | null; del: number | null; age: string }

export const ageOf = (ms: number): string => {
  const sec = Math.max(0, Math.round(ms / 1000))
  return sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`
}

// Most recent first.
export const touchedRows = (t: Touched, now: number): TouchedRow[] =>
  [...t.files].reverse().map(f => ({ path: f.path, kind: f.kind, add: f.add, del: f.del, age: ageOf(now - f.at) }))
