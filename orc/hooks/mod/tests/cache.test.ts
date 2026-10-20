import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { cacheState, coldToast, isColdRewrite, parseDuration, pingGone } from '../cache/model'
import { cacheAlt, cacheLine } from '../cache/text'
import { cacheSvg } from '../cache/svg'
import { fitSvg } from '../draw/svg'
import { flush, ran } from './helpers'

const MIN = 60_000
const FABLE = 'claude-fable-5-1' // cache write $20 per MTok
const base = { lastAt: 0, lastContext: 180_000, model: FABLE, ttlMs: 60 * MIN }

// --- pure ---
test('cacheState: warm above 15 min left, cooling within 15, cold past the ttl', () => {
  expect(cacheState({ ...base, now: 30 * MIN })).toMatchObject({ phase: 'warm', minutesLeft: 30, coldFor: 0 })
  expect(cacheState({ ...base, now: 50 * MIN + 1 })).toMatchObject({ phase: 'cooling', minutesLeft: 10 })
  expect(cacheState({ ...base, now: 45 * MIN })).toMatchObject({ phase: 'cooling', minutesLeft: 15 })
  expect(cacheState({ ...base, now: 72 * MIN })).toMatchObject({ phase: 'cold', minutesLeft: 0, coldFor: 12 * MIN })
})

test('cacheState prices the rewrite from the model, null when unpriced', () => {
  expect(cacheState({ ...base, now: 50 * MIN }).rewriteUsd).toBe(3.6)
  expect(cacheState({ ...base, model: 'claude-haiku-4-5', now: 50 * MIN }).rewriteUsd).toBeNull()
})

test('isColdRewrite needs a big write over a big previous context', () => {
  const u = (w: number) => ({ cache_creation_input_tokens: w })
  expect(isColdRewrite(180_000, u(90_000))).toBe(true)
  expect(isColdRewrite(180_000, u(89_999))).toBe(false)
  expect(isColdRewrite(20_000, u(20_000))).toBe(false)
  expect(isColdRewrite(30_000, u(15_000))).toBe(true)
})

test('parseDuration reads 90m / 2h / 1h30m and refuses the rest', () => {
  expect([parseDuration('2h'), parseDuration('90m'), parseDuration('1h30m')]).toEqual([7_200_000, 5_400_000, 5_400_000])
  expect([parseDuration('off'), parseDuration(''), parseDuration('soon'), parseDuration('0m')]).toEqual([null, null, null, null])
})

test('pingGone: the ping wrote 10% or more of what it read', () => {
  expect(pingGone({ cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 })).toBe(true)
  expect(pingGone({ cache_creation_input_tokens: 99, cache_read_input_tokens: 1000 })).toBe(false)
  expect(pingGone({ cache_creation_input_tokens: 0, cache_read_input_tokens: 0 })).toBe(false)
})

test('coldToast words, with and without a price', () => {
  expect(coldToast(72 * MIN, 180_000, 3.6)).toBe('cache went cold 1h12m ago · this send re-writes ~180k tok ≈ $3.60')
  expect(coldToast(12 * MIN, 45_000, null)).toBe('cache went cold 12m ago · this send re-writes ~45k tok')
})

test('the cache row line and drawing', () => {
  const row = { kind: 'cache' as const, minutesLeft: 9, rewriteUsd: 3.6, tokens: 180_000, waitingOn: null }
  expect(cacheLine(row)).toBe('cache cools in 9 min · re-write ~180k tok ≈ $3.60')
  expect(cacheLine({ ...row, rewriteUsd: null, waitingOn: 'your answer' })).toBe('cache cools in 9 min · re-write ~180k tok · waiting on your answer')
  expect(cacheAlt(row)).toBe(cacheLine(row))
  expect(fitSvg(cacheSvg(row, 640))).not.toBeNull()
})

// --- engine ---
const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-x', gitBranch: 'feat/x', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 })
const RUN = (args = '') => ({ command: 'orc', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } })
const START = { surface: 'terminal' as const, isInteractive: true, cwd: '/work' }
const ABOVE = (surface: 'terminal' | 'desktop', isWorking = false) => ({
  plugin: 'orc', surface, component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: 120, scroll: {} as never, view: {} as never },
})
const STEP = { turnId: 't1', index: 0, model: FABLE, messageCount: 2 }
const usage = (o: Partial<Record<string, number>> = {}) => ({ model: FABLE, input_tokens: 1000, output_tokens: 50, cache_read_input_tokens: 179_000, cache_creation_input_tokens: 0, ...o })

type World = { toasts: string[]; forks: number; fills: unknown[]; store: Map<string, unknown>; submits: unknown[]; forkUsage: { v: Record<string, number>; gate: Promise<void> | null } }
function world(on: On, now = 1_000_000): World & { clock: ReturnType<typeof mock.clock> } {
  const clock = mock.clock(on, { now })
  const w: World = { toasts: [], forks: 0, fills: [], store: new Map(), submits: [], forkUsage: { v: { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 180_000, cache_creation_input_tokens: 0 }, gate: null } }
  on('process.run', ($, e) => (e.argv[1] === 'get' ? ran(SESSION) : ran('')))
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: { command: 'orc' } }))
  on('session.id', () => ({ value: 's1' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('store.get', ($, e) => ({ value: w.store.get(e.key) }))
  on('store.set', ($, e) => { w.store.set(e.key, e.value); return { value: undefined } })
  on('ui.toast', ($, e) => { w.toasts.push(e.text); return { value: undefined } })
  on('prompt.fill', ($, e) => { w.fills.push(e); return { value: { isFilled: true } } })
  on('prompt.submit', ($, e) => { w.submits.push(e); return { text: e.text } })
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: stepUsage.v }
  })
  on('model.fork', async () => {
    w.forks++
    if (w.forkUsage.gate) await w.forkUsage.gate
    return { value: { isAnswered: true as const, text: 'warm', usage: { model: FABLE, ...w.forkUsage.v } } } as never
  })
  return Object.assign(w, { clock })
}
const stepUsage = { v: usage() }
async function step($: any, u = usage()) {
  stepUsage.v = u
  for await (const _ of $.turn.step(STEP)) { /* drain */ }
}
// Move the clock, then let the ping's async chain (state reads, the fork, the reschedule) finish.
async function go(w: { clock: { advance(ms: number): Promise<void>; settle(): Promise<void> } }, ms: number) {
  await w.clock.advance(ms)
  for (let i = 0; i < 5; i++) { await w.clock.settle(); await flush(200) }
}
const submit = ($: any, kind = 'composer') => $.prompt.submit({ text: 'go on', wait: false, origin: { kind } })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the cache row shows on ${surface} when idle and within 15 minutes of the cliff`, async ($, on) => {
    const w = world(on)
    await $.command.run(RUN())
    await step($)
    await w.clock.advance(52 * MIN)
    const ui = await $.ui.mount(ABOVE(surface))
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /cache cools in 8 min · re-write ~180k tok ≈ \$3\.60/ })).toBeDefined()
    else expect(await ui.find({ type: 'Svg', alt: /cache cools in 8 min/ })).toBeDefined()
    expect(await ui.find({ key: 'cache-warm' })).toMatchObject({ props: { label: 'Keep warm' } })
    await ui.press({ key: 'cache-warm' })
    expect(w.fills).toMatchObject([{ text: '/orc keepwarm 1h' }])
    await ui.unmount()
  })
}

test('no cache row while warm, while working, or with cache_cliff off', async ($, on) => {
  const w = world(on)
  await $.command.run(RUN())
  await step($)
  await w.clock.advance(20 * MIN)
  let ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.findAll({ type: 'Text', text: /cache cools/ })).toEqual([])
  await ui.unmount()
  await w.clock.advance(32 * MIN)
  ui = await $.ui.mount(ABOVE('terminal', true))
  expect(await ui.findAll({ type: 'Text', text: /cache cools/ })).toEqual([])
  await ui.unmount()
})

test('cache_cliff: off hides the row and the toast', { options: { cache_cliff: 'off' } }, async ($, on) => {
  const w = world(on)
  await $.command.run(RUN())
  await step($)
  await w.clock.advance(52 * MIN)
  const ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.findAll({ type: 'Text', text: /cache cools/ })).toEqual([])
  await ui.unmount()
  await w.clock.advance(30 * MIN)
  await submit($)
  expect(w.toasts).toEqual([])
})

test('the row says what it is waiting on while an AskUserQuestion is open', async ($, on) => {
  const w = world(on)
  await $.command.run(RUN())
  await step($)
  await w.clock.advance(52 * MIN)
  const q = await $.ui.mount({
    plugin: 'orc', component: 'AskUserQuestion' as const, requestId: 'toolu_q', surface: 'terminal' as const, viewport: { columns: 120, rows: 40 },
    props: { tool: 'AskUserQuestion', questions: [{ header: 'Plan', question: 'Go?', multiSelect: false, options: [{ label: 'Yes', description: 'y' }, { label: 'No', description: 'n' }] }] as unknown[] },
  })
  const ui = await $.ui.mount(ABOVE('terminal', true))
  expect(await ui.find({ type: 'Text', text: /waiting on your answer/ })).toBeDefined()
  await ui.unmount()
  await q.unmount()
})

test('a composer send past the ttl toasts the rewrite and goes through unchanged', async ($, on) => {
  const w = world(on)
  await $.command.run(RUN())
  await step($)
  await w.clock.advance(132 * MIN)
  const r = await submit($)
  expect(w.toasts).toEqual(['cache went cold 1h12m ago · this send re-writes ~180k tok ≈ $3.60'])
  expect(r).toEqual({ text: 'go on' })
  expect(w.submits.length).toBe(1)
})

test('no cold toast when unattended, warm, or the context is small', async ($, on) => {
  const w = world(on)
  await $.command.run(RUN())
  await step($, usage({ cache_read_input_tokens: 9000 }))
  await w.clock.advance(132 * MIN)
  await submit($)
  expect(w.toasts).toEqual([])
  await step($)
  await w.clock.advance(132 * MIN)
  await submit($, 'scheduled-trigger')
  await submit($, 'task-notification')
  expect(w.toasts).toEqual([])
  await step($)
  await w.clock.advance(10 * MIN)
  await submit($)
  expect(w.toasts).toEqual([])
})

test('a send with no priced model still toasts, in tokens', async ($, on) => {
  const w = world(on)
  await $.command.run(RUN())
  await step($, usage({ model: 'claude-haiku-4-5' }))
  await w.clock.advance(132 * MIN)
  await submit($)
  expect(w.toasts).toEqual(['cache went cold 1h12m ago · this send re-writes ~180k tok'])
})

test('/orc keepwarm 2h pings at 50 and 100 minutes, then stops at the deadline', async ($, on) => {
  const w = world(on)
  await $.session.start(START)
  const r = await $.command.run(RUN('keepwarm 2h'))
  expect(JSON.stringify(r)).toMatch(/2h/)
  expect(w.store.get('keepwarm:s1')).toBe(1_000_000 + 120 * MIN)
  await go(w, 49 * MIN)
  expect(w.forks).toBe(0)
  await go(w, 1 * MIN)
  expect(w.forks).toBe(1)
  await go(w, 50 * MIN)
  expect(w.forks).toBe(2)
  await go(w, 60 * MIN)
  expect(w.forks).toBe(2)
  expect(w.store.get('keepwarm:s1')).toBeNull()
})

test('/orc keepwarm off stops the pings', async ($, on) => {
  const w = world(on)
  await $.session.start(START)
  await $.command.run(RUN('keepwarm 2h'))
  await $.command.run(RUN('keepwarm off'))
  await go(w, 120 * MIN)
  expect(w.forks).toBe(0)
  expect(w.store.get('keepwarm:s1')).toBeNull()
})

test('a bad duration is refused with usage', async ($, on) => {
  const w = world(on)
  await $.session.start(START)
  expect(JSON.stringify(await $.command.run(RUN('keepwarm soon')))).toMatch(/usage/i)
  await go(w, 120 * MIN)
  expect(w.forks).toBe(0)
})

test('a ping that had to re-write the cache stops keep-warm', async ($, on) => {
  const w = world(on)
  w.forkUsage.v = { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 }
  await $.session.start(START)
  await $.command.run(RUN('keepwarm 5h'))
  await go(w, 50 * MIN)
  expect(w.forks).toBe(1)
  await go(w, 100 * MIN)
  expect(w.forks).toBe(1)
  expect(w.toasts.join('|')).toMatch(/keep-warm stopped/)
})

test('a ping that lands after keep-warm was turned off is discarded', async ($, on) => {
  const w = world(on)
  let open!: () => void
  w.forkUsage.gate = new Promise<void>(r => { open = r })
  await $.session.start(START)
  await $.command.run(RUN())
  await step($)
  await $.command.run(RUN('keepwarm 5h'))
  await go(w, 50 * MIN)
  expect(w.forks).toBe(1)
  await $.command.run(RUN('keepwarm off'))
  open(); await go(w, 0)
  await go(w, 15 * MIN)
  expect(w.forks).toBe(1)
  // The stale ping did not refresh the clock: 65 minutes after the last real request, the cache is cold.
  await submit($)
  expect(w.toasts.some(t => t.startsWith('cache went cold'))).toBe(true)
})

test('a ping keeps the clock: no cold toast 40 minutes after it', async ($, on) => {
  const w = world(on)
  await $.session.start(START)
  await $.command.run(RUN())
  await step($)
  await $.command.run(RUN('keepwarm 3h'))
  await go(w, 50 * MIN)
  expect(w.forks).toBe(1)
  await w.clock.advance(40 * MIN)
  await submit($)
  expect(w.toasts).toEqual([])
})

test('a stored deadline re-arms keep-warm when the plugin loads again', async ($, on) => {
  const w = world(on)
  w.store.set('keepwarm:s1', 1_000_000 + 120 * MIN)
  await $.session.start(START)
  await go(w, 50 * MIN)
  expect(w.forks).toBe(1)
})
