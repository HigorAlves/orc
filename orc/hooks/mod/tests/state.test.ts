import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { ran } from './helpers'

const SESSION = JSON.stringify({
  command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress',
  phase: 5, phaseLabel: 'implement', totalPhases: 9, jiraTicket: null,
})
const USAGE = { startedAt: 0, context: { window: 200000, tokens: 84000, percent: 42 }, rateLimits: [], cost: { usd: 0.4211 } }
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }

// Count every orc-state `get`; answer the rest empty.
function world(on: On) {
  const gets: number[] = []
  on('process.run', ($, e) => {
    if (e.argv[1] === 'get') { gets.push(1); return ran(SESSION) }
    return ran('')
  })
  on('session.usage', () => ({ value: USAGE }))
  on('session.surfaces', () => ({ value: [] }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
  on('turn.complete', () => ({ text: '' }))
  return gets
}

const bash = (command: string) => ({ tool: 'Bash' as const, command })
const done = (agentId?: string) => ({
  turnId: 't1', answer: '', durationMs: 10, isAborted: false, reason: 'answer' as const, text: '',
  usage: { model: 'claude-sonnet-5-5', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  ...(agentId ? { agentId } : {}),
})

test('/orc loads the snapshot into state, with the session meter', async ($, on) => {
  const gets = world(on)
  // The test's own $ has no state noun; the write is observed beneath the plugin instead.
  const writes: unknown[] = []
  on('state.set', ($, e) => { writes.push(e.value); return { value: { isSet: true, version: writes.length } } })
  await $.command.run(RUN)
  expect(gets.length).toBe(1)
  const value = writes.at(-1) as { session?: { phase?: number }; meter?: unknown } | undefined
  expect(value?.session?.phase).toBe(5)
  expect(value?.meter).toEqual({ contextPercent: 42, usd: 0.42 })
})

test('an orc-state write through Bash refreshes the snapshot; other commands do not', async ($, on) => {
  const gets = world(on)
  await $.command.run(RUN)
  await $.tool.call(bash('orc-state slice set 1 --status committed --commit abc1234'))
  expect(gets.length).toBe(2)
  await $.tool.call(bash('ls -la'))
  await $.tool.call(bash('orc-state slice list'))
  expect(gets.length).toBe(2)
})

test('a main-loop turn refreshes; a subagent turn does not', async ($, on) => {
  const gets = world(on)
  await $.command.run(RUN)
  await $.turn.complete(done('a1'))
  expect(gets.length).toBe(1)
  await $.turn.complete(done())
  expect(gets.length).toBe(2)
})
