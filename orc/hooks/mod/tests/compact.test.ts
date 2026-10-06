import { expect, test } from 'claude-code/testing'

const MESSAGES = [{ role: 'user' as const, text: 'add CSV export', toolUses: [] }]
const LINE = '{"command":"flow","phase":5,"totalPhases":9,"phaseLabel":"implement","slicesDone":3,"slicesTotal":7}'

// What `orc-state line` printed, as $.process.run resolves it.
const ran = (stdout: string) => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

test('a main-session compaction carries the live orc state to the summarizer', async ($, on) => {
  let told: string | undefined
  on('process.run', () => ran(LINE + '\n'))
  on('session.compact', ($, e) => { told = e.instructions; return { messages: e.messages } })
  await $.session.compact({ trigger: 'auto', instructions: 'keep the API decisions', messages: MESSAGES })
  expect(told).toContain('keep the API decisions')
  expect(told).toContain(LINE)
})

test('no live orc session leaves the instructions alone', async ($, on) => {
  let told: string | undefined
  on('process.run', () => ran(''))
  on('session.compact', ($, e) => { told = e.instructions; return { messages: e.messages } })
  await $.session.compact({ trigger: 'manual', messages: MESSAGES })
  expect(told).toBeUndefined()
})

test('a subagent transcript is not touched', async ($, on) => {
  let told: string | undefined
  on('process.run', () => ran(LINE))
  on('session.compact', ($, e) => { told = e.instructions; return { messages: e.messages } })
  await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: MESSAGES })
  expect(told).toBeUndefined()
})

test('a speculative precompute is not touched', async ($, on) => {
  let told: string | undefined
  on('process.run', () => ran(LINE))
  on('session.compact', ($, e) => { told = e.instructions; return { messages: e.messages } })
  await $.session.compact({ trigger: 'precompute', messages: MESSAGES })
  expect(told).toBeUndefined()
})

test('mod_enabled: false leaves compaction to the engine', { options: { mod_enabled: false } }, async ($, on) => {
  let told: string | undefined
  on('process.run', () => ran(LINE))
  on('session.compact', ($, e) => { told = e.instructions; return { messages: e.messages } })
  await $.session.compact({ trigger: 'auto', messages: MESSAGES })
  expect(told).toBeUndefined()
})
