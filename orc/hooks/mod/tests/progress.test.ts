import { expect, test } from 'claude-code/testing'
import { fitSvg } from '../draw/svg'
import { agentRowLine, agentRows, type LedgerLike } from '../progress/model'
import { progressModel } from '../progress/model'
import { progressText } from '../progress/text'
import { progressAlt, progressSvg } from '../progress/svg'
import type { Snapshot } from '../cockpit'

const snap: Snapshot = {
  session: { command: 'flow', branch: 'feat-billing-tax', gitBranch: 'feat/billing-tax', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 },
  slices: [
    { id: '1', status: 'committed', title: 'a', commit: 'aaa' }, { id: '2', status: 'committed', title: 'b', commit: 'bbb' },
    { id: '3', status: 'committed', title: 'c', commit: 'ccc' }, { id: '4', status: 'red', title: 'd', commit: null },
    { id: '5', status: 'green', title: 'e', commit: null }, { id: '6', status: 'pending', title: 'f', commit: null },
    { id: '7', status: 'pending', title: 'g', commit: null },
  ],
  decisions: [],
}
const entry = (o: Partial<LedgerLike['main']>): LedgerLike['main'] => ({
  requests: 1, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, lastAt: 0, lastContext: 0, model: 'claude-sonnet-5-5', ms: 0,
  type: 'orc:orc-implementer', step: null, startedAt: 0, finishedAt: null, ...o,
})
const ledger: LedgerLike = {
  main: entry({ type: null }),
  agents: {
    old: entry({ lastContext: 20_000, startedAt: 0, lastAt: 1_000, finishedAt: 1_500 }),
    live: entry({ lastContext: 76_000, startedAt: 1_000, lastAt: 193_000, step: { label: 'writing failing test', n: 2, of: 5 } }),
  },
}
const NOW = 195_000

test('progressModel summarises the billing fixture', () => {
  expect(progressModel(snap, ledger)).toEqual({
    title: 'billing-tax', phase: 5, phaseLabel: 'implement', totalPhases: 9, done: 3, running: 2, total: 7,
    qa: null, pr: null, agents: 2, next: '/orc:resume',
  })
})

test('progressModel suggests qa, ship, and reads qa verdict and pr', () => {
  const allDone: Snapshot = { ...snap, slices: snap.slices.map(s => ({ ...s, status: 'committed', commit: 'x' })) }
  expect(progressModel(allDone, ledger).next).toBe('/orc:qa')
  const passed: Snapshot = {
    ...allDone, qa: { verdict: 'pass', acceptance: [], missing: [] },
    session: { ...snap.session!, phase: 7, linkedPRs: [{ number: 42 }] },
  }
  const m = progressModel(passed, ledger)
  expect([m.qa, m.pr, m.next]).toEqual(['pass', 42, '/orc:ship'])
  expect(progressModel({ session: null, slices: [], decisions: [] }, ledger)).toBeNull()
})

test('progressText renders the status line, bar scaled to columns', () => {
  const m = progressModel(snap, ledger)!
  expect(progressText(m, 120)).toBe('orc · billing-tax · ⑤ implement  ▓▓▓▓▓▓▒▒▒▒░░░░ 3/7 · QA — · PR —  ×2')
  const narrow = progressText(m, 40)
  expect(narrow).toContain('▓▓')
  expect((narrow.match(/[▓▒░]/g) ?? []).length).toBe(7)
})

test('progressSvg has 7 segments, 9 phase dots, fits, and alt reads plainly', () => {
  const m = progressModel(snap, ledger)!
  const svg = progressSvg(m, 640)
  expect(svg.length).toBeLessThanOrEqual(131_072)
  expect((svg.match(/<rect[^>]*height="8"/g) ?? []).length).toBe(7)
  expect((svg.match(/<circle[^>]*data-phase/g) ?? []).length).toBe(9)
  expect(fitSvg(svg)).not.toBeNull()
  expect(progressAlt(m)).toBe('orc billing-tax: phase 5 of 9 implement, 3 of 7 slices done, 2 running')
})

test('agentRows puts running agents first and formats ctx, cost, elapsed', () => {
  const costOf = (_u: unknown, model: string) => (model.startsWith('claude-sonnet') ? 0.41 : null)
  const rows = agentRows(ledger, costOf, NOW)
  expect(rows.map(r => [r.name, r.running])).toEqual([['live', true], ['old', false]])
  expect(agentRowLine(rows[0])).toBe('ctx 38% · $0.41 · 3m12s')
  expect(agentRows({ ...ledger, agents: { x: entry({ model: null }) } }, costOf, NOW)[0].usd).toBeNull()
})
