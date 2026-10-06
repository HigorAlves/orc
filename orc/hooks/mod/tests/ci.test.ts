import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { flush, ran } from './helpers'

const PR = 'https://github.com/acme/app/pull/12'
const SESSION = JSON.stringify({ command: 'flow', gitBranch: 'feat/x', status: 'in_progress', phase: 7, totalPhases: 9, linkedPRs: [{ url: PR, number: 12 }] })
const RED = JSON.stringify([{ name: 'lint', bucket: 'fail' }, { name: 'test', bucket: 'fail' }, { name: 'build', bucket: 'pass' }])
const RUNNING = JSON.stringify([{ name: 'test', bucket: 'pending' }, { name: 'build', bucket: 'pass' }])
const GREEN = JSON.stringify([{ name: 'test', bucket: 'pass' }, { name: 'build', bucket: 'pass' }])

// Wire every stub the watcher touches; returns what it did.
function world(on: On, checks: () => string, opts: { store?: Map<string, unknown>; sid?: string } = {}) {
  const store = opts.store ?? new Map<string, unknown>()
  const seen = { toasts: [] as string[], status: [] as (string | undefined)[], suggested: [] as string[], gh: 0 }
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: { command: 'orc' } }))
  on('session.id', () => ({ value: opts.sid ?? 's1' }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined } })
  on('ui.toast', ($, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.status', ($, e) => { seen.status.push(e.text); return { value: undefined } })
  on('prompt.suggest', ($, e) => { seen.suggested.push(e.text); return { isShown: true } })
  on('process.run', ($, e) => {
    if (e.argv[0] === 'gh') { seen.gh += 1; return ran(checks()) }
    return e.argv[1] === 'get' ? ran(SESSION) : ran('')
  })
  return { store, seen }
}

const START = { surface: 'terminal' as const, isInteractive: true, cwd: '/work' }

test('red CI on a linked PR: one toast, a status line, and /orc:ci suggested', async ($, on) => {
  const clock = mock.clock(on)
  const { seen } = world(on, () => RED)
  await $.session.start(START)
  await clock.advance(60_000); await flush()
  expect(seen.toasts).toEqual(['CI red on #12: lint, test — /orc:ci to diagnose'])
  expect(seen.status.at(-1)).toBe('CI #12: 2 failing (lint, test)')
  expect(seen.suggested).toEqual(['/orc:ci 12'])
  // Re-polled after the settle window with the same failure set: no second alert.
  await clock.advance(360_000); await flush()
  expect(seen.gh).toBeGreaterThan(1)
  expect(seen.toasts.length).toBe(1)
})

test('pending then green: one green toast', async ($, on) => {
  const clock = mock.clock(on)
  let checks = RUNNING
  const { seen } = world(on, () => checks)
  await $.session.start(START)
  await clock.advance(60_000); await flush()
  expect(seen.toasts).toEqual([])
  checks = GREEN
  await clock.advance(60_000); await flush()
  expect(seen.toasts).toEqual(['CI green on #12'])
})

test('another live session holds the lease: no gh call, its result is shown', async ($, on) => {
  const clock = mock.clock(on)
  const store = new Map<string, unknown>([['ci:' + PR, {
    lease: { sid: 'other', until: 10_000_000 },
    summary: { state: 'fail', failing: ['lint'], pending: 0, total: 2 },
  }]])
  const { seen } = world(on, () => RED, { store })
  await $.session.start(START)
  await clock.advance(60_000); await flush()
  expect(seen.gh).toBe(0)
  expect(seen.toasts).toEqual([])
  expect(seen.status.at(-1)).toBe('CI #12: 1 failing (lint)')
})

test('a non-interactive session never polls', async ($, on) => {
  const clock = mock.clock(on)
  const { seen } = world(on, () => RED)
  await $.session.start({ ...START, surface: null, isInteractive: false })
  await clock.advance(120_000); await flush()
  expect(seen.gh).toBe(0)
})
