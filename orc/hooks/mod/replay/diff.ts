// Line diff for the replay pane: pure. The LCS approach is ported, with changes, from the
// Replay Theater sample (Apache-2.0, see THIRD-PARTY-LICENSES.md); the output
// is unified hunks, which is what `Code format: 'diff'` parses.
export const MAX_LCS_LINES = 400
export const MAX_DIFF_CHARS = 10_000
const CONTEXT = 3

type Op = { op: ' ' | '+' | '-'; t: string }

const splitLines = (text: string): string[] => {
  if (!text) return []
  const lines = text.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function diffOps(a: string[], b: string[]): Op[] {
  if (a.length > MAX_LCS_LINES || b.length > MAX_LCS_LINES) {
    return [...a.map((t): Op => ({ op: '-', t })), ...b.map((t): Op => ({ op: '+', t }))]
  }
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: Op[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: ' ', t: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: '-', t: a[i++] })
    else out.push({ op: '+', t: b[j++] })
  }
  while (i < n) out.push({ op: '-', t: a[i++] })
  while (j < m) out.push({ op: '+', t: b[j++] })
  return out
}

// Index ranges [from, to) of ops that form one hunk, with CONTEXT lines around changes.
function hunkRanges(ops: Op[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  ops.forEach((o, k) => {
    if (o.op === ' ') return
    const from = Math.max(0, k - CONTEXT), to = Math.min(ops.length, k + CONTEXT + 1)
    const last = ranges[ranges.length - 1]
    if (last && from <= last[1]) last[1] = to
    else ranges.push([from, to])
  })
  return ranges
}

function header(kept: Op[], aStart: number, bStart: number): string {
  const aCount = kept.filter(o => o.op !== '+').length, bCount = kept.filter(o => o.op !== '-').length
  return `@@ -${aCount ? aStart : Math.max(0, aStart - 1)},${aCount} +${bCount ? bStart : Math.max(0, bStart - 1)},${bCount} @@`
}

export function unifiedDiff(oldText: string, newText: string, path: string): string {
  const ops = diffOps(splitLines(oldText), splitLines(newText))
  const ranges = hunkRanges(ops)
  if (!ranges.length) return ''
  // 1-based line numbers of each op on each side.
  const aAt: number[] = [], bAt: number[] = []
  let a = 1, b = 1
  for (const o of ops) { aAt.push(a); bAt.push(b); if (o.op !== '+') a++; if (o.op !== '-') b++ }

  const out = [`--- a/${path}`, `+++ b/${path}`]
  let used = out.join('\n').length
  for (const [from, to] of ranges) {
    let kept = ops.slice(from, to)
    // Budget: header line (≤ ~40 chars) plus each body line and its newline.
    let budget = MAX_DIFF_CHARS - used - 48, n = 0
    for (const o of kept) { budget -= o.t.length + 2; if (budget < 0) break; n++ }
    kept = kept.slice(0, n)
    if (!kept.some(o => o.op !== ' ')) break
    const h = header(kept, aAt[from], bAt[from])
    const body = kept.map(o => o.op + o.t)
    out.push(h, ...body)
    used += h.length + 1 + body.reduce((s, l) => s + l.length + 1, 0)
    if (n < to - from) break
  }
  return out.join('\n')
}
