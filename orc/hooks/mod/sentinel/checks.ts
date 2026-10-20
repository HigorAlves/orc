// Model-free sentinel checks: pure, each returns a note with a stable id (so a
// dismissed note doesn't return) or null.
export type Touched = { path: string; kind: 'read' | 'edit' | 'committed' }
export type SentinelNote = { id: string; text: string }

const isTest = (p: string) => /(^|\/)(tests?|__tests__)\//.test(p) || /\.(test|spec)\.[a-z]+$/.test(p)
const dirOf = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/')))
const same = (a: string, b: string) => a === b || a.endsWith('/' + b) || b.endsWith('/' + a)

export function outsideSlice(touched: Touched[], touchpoints: string[]): SentinelNote | null {
  const testDirs = touchpoints.filter(isTest).map(dirOf)
  const out = [...new Set(touched
    .filter(t => t.kind === 'edit')
    .map(t => t.path)
    .filter(p => !touchpoints.some(tp => same(p, tp)))
    .filter(p => !(isTest(p) && testDirs.some(d => dirOf(p) === d || dirOf(p).endsWith('/' + d)))))].sort()
  if (!out.length) return null
  return { id: 'outside-slice:' + out.join(','), text: `Edited outside this slice's files: ${out.join(', ')}` }
}

export function budgetCreep(o: { loc: number; budget: number; done: number; total: number }): SentinelNote | null {
  if (o.done >= o.total) return null
  const projected = Math.round(o.loc / Math.max(1, o.done) * o.total)
  if (projected <= 0.9 * o.budget) return null
  return { id: 'budget-creep', text: `Projected ${projected} LOC at this pace vs budget ${o.budget}` }
}

export function repeatedFailure(history: { command: string; ok: boolean }[]): SentinelNote | null {
  const last = history.slice(-3)
  if (last.length < 3 || last.some(h => h.ok || h.command !== last[0].command)) return null
  return { id: 'repeat-fail:' + last[0].command, text: `\`${last[0].command}\` has failed 3 times in a row` }
}
