import { expect, test } from 'claude-code/testing'
import { ORIGIN, ran, spawnOf } from './helpers'

const USAGE = { model: 'claude-sonnet-5-5', input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const done = (agentId?: string) => ({
  turnId: 't1', answer: 'slice green', durationMs: 4200, isAborted: false, reason: 'answer' as const, text: '',
  usage: USAGE, ...(agentId ? { agentId } : {}),
})

test('a finished orc subagent run lands in the usage ledger via orc-state', async ($, on) => {
  const calls: string[][] = []
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }))
  on('process.run', ($, e) => { calls.push([...e.argv]); return ran('') })
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  await $.turn.complete(done('a1'))
  const add = calls.find(argv => argv[1] === 'usage')
  expect(add?.slice(1)).toEqual(['usage', 'add', '--agent', 'orc-implementer', '--model', 'claude-sonnet-5-5', '--in', '1200', '--out', '300', '--ms', '4200'])
})

test('main-loop turns and non-orc agents are not recorded', async ($, on) => {
  const calls: string[][] = []
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'x1' }))
  on('turn.complete', () => ({ text: '' }))
  on('process.run', ($, e) => { calls.push([...e.argv]); return ran('') })
  await $.agent.spawn({ ...spawnOf('Explore'), provider: ORIGIN })
  await $.turn.complete(done('x1'))
  await $.turn.complete(done())
  expect(calls.filter(argv => argv[1] === 'usage' && argv[2] === 'add')).toEqual([])
})
