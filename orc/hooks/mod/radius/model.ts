// Ship radius: how big the branch is against its budget, how many files it
// touches and (when a Graphify graph answers) how many other nodes depend on them. Pure.

export type Radius = { loc: number; budget: number; files: number; dependents: number | null }

export const MAX_PROBED = 10

// `graphify affected` prints `- name [relation] path:Lnn` lines under an
// "Affected nodes for X" header; "No unique node match for X" means the graph
// knows nothing of that name.
export type Affected = { matched: boolean; nodes: { name: string; file: string }[] }

export function parseAffected(stdout: string): Affected {
  const nodes = stdout.split('\n').flatMap(l => {
    const m = /^- (.+?) \[[^\]]*\] (.+?)(?::L\d+)?\s*$/.exec(l)
    return m ? [{ name: m[1], file: m[2] }] : []
  })
  return { matched: /^Affected nodes for /m.test(stdout), nodes }
}

// Distinct dependents outside the changed files, across the probed files; null when the graph matched none of them.
export function countDependents(results: Affected[], changed: string[]): number | null {
  if (!results.some(r => r.matched)) return null
  const own = new Set(changed)
  const seen = new Set<string>()
  for (const r of results) for (const n of r.nodes) if (!own.has(n.file)) seen.add(n.name + '@' + n.file)
  return seen.size
}

export const parseNames = (stdout: string): string[] => stdout.split('\n').map(l => l.trim()).filter(Boolean)
