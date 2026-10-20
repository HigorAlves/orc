import { expect, test } from 'claude-code/testing'
import { ENTRY_INITIAL, LEDGER_INITIAL, dropAgent, recordStep, tagAgent } from '../ledger'
import { costOf, rewriteCost } from '../prices'
import { ORIGIN, spawnOf } from './helpers'

const U = { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 }

test('recordStep sums the four counts on main', () => {
  const a = recordStep(LEDGER_INITIAL, { agentId: null, usage: U, at: 1000, ms: 40 })
  const b = recordStep(a, { agentId: null, usage: U, at: 2000, ms: 60 })
  expect(b.main).toMatchObject({ requests: 2, input: 20, output: 10, cacheRead: 200, cacheWrite: 40, lastAt: 2000, startedAt: 1000, ms: 100, lastContext: 130, model: 'claude-opus-5-5' })
  expect(b.agents).toEqual({})
})

test('an agent step never touches main', () => {
  const l = recordStep(LEDGER_INITIAL, { agentId: 'a1', usage: U, at: 1000, ms: 5 })
  expect(l.main).toEqual(ENTRY_INITIAL)
  expect(l.agents.a1.requests).toBe(1)
})

test('a step without usage still counts the request and keeps the last context', () => {
  const a = recordStep(LEDGER_INITIAL, { agentId: null, usage: U, at: 1, ms: 0 })
  const b = recordStep(a, { agentId: null, usage: null, at: 2, ms: 0 })
  expect(b.main).toMatchObject({ requests: 2, lastContext: 130, model: 'claude-opus-5-5', input: 10 })
})

test('tagAgent and dropAgent', () => {
  const t = tagAgent(LEDGER_INITIAL, 'a1', 'orc-implementer')
  expect(t.agents.a1).toMatchObject({ type: 'orc-implementer', requests: 0 })
  expect(dropAgent(t, 'a1').agents).toEqual({})
})

test('costOf prices a known model from list prices and refuses an unknown one', () => {
  // Opus 5.5 list: $4 in, $20 out, $0.20 cache read, $8 1h cache write per MTok.
  const m = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 }
  expect(Math.round((costOf(m, 'claude-opus-5-5') as number) * 1e6)).toBe(32_200_000)
  expect(costOf(m, 'claude-nonesuch-1')).toBeNull()
  expect(rewriteCost(500_000, 'claude-opus-5-5')).toBe(4)
  expect(rewriteCost(500_000, 'claude-nonesuch-1')).toBeNull()
})

test('a main step lands in the ledger', async ($, on) => {
  const writes: unknown[] = []
  on('clock.now', () => ({ value: 1000 }))
  on('state.set', ($, e, next) => { writes.push(e); return next(e) })
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: U }
  })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 2 })
  let it = await stream.next()
  while (!it.done) it = await stream.next()
  const r = it.value // the generator's return value (the kit's stream.result resolves undefined)
  expect(r.usage?.input_tokens).toBe(10)
  const ledger = lastLedger(writes)
  expect(ledger.main.requests).toBe(1)
  expect(ledger.main).toMatchObject({ input: 10, output: 5, cacheRead: 100, cacheWrite: 20, lastAt: 1000 })
  expect(Object.keys(ledger.agents)).toEqual([])
})

test('a subagent step lands under its agentId', async ($, on) => {
  const writes: unknown[] = []
  on('clock.now', () => ({ value: 1000 }))
  on('state.set', ($, e, next) => { writes.push(e); return next(e) })
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: U }
  })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 2, agentId: 'a9' })
  for await (const _ of stream) { /* drain */ }
  const ledger = lastLedger(writes)
  expect(ledger.main.requests).toBe(0)
  expect(ledger.agents.a9.requests).toBe(1)
})

test('an orc agent is tagged on spawn and kept until the next main turn completes', async ($, on) => {
  const writes: unknown[] = []
  on('clock.now', () => ({ value: 1000 }))
  on('state.set', ($, e, next) => { writes.push(e); return next(e) })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: U }
  })
  await $.agent.spawn({ ...spawnOf('orc:orc-implementer'), provider: ORIGIN })
  expect(lastLedger(writes).agents.a1?.type).toBe('orc-implementer')
  const done = { turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' as const, text: '' }
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(lastLedger(writes).agents.a1?.type).toBe('orc-implementer')
  await $.turn.complete(done)
  expect(lastLedger(writes).agents).toEqual({})
})

type Ledger = { main: Record<string, unknown> & { requests: number }; agents: Record<string, Record<string, unknown> & { requests: number; type?: string }> }
function lastLedger(writes: unknown[]): Ledger {
  const hits = writes.filter(w => (w as { key?: string }).key === 'ledger')
  return (hits.at(-1) as { value: Ledger }).value
}
