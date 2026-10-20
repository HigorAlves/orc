import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { ENTRY_INITIAL, LEDGER_INITIAL, finishAgent, setStep } from '../ledger'
import { agentRows } from '../progress/model'
import { ran, spawnOf } from './helpers'

const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-billing-tax', gitBranch: 'feat/billing-tax', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 })
const SLICES = ['1\tcommitted\ta\taaa', '2\tcommitted\tb\tbbb', '3\tcommitted\tc\tccc', '4\tred\td\t-', '5\tgreen\te\t-', '6\tpending\tf\t-', '7\tpending\tg\t-'].join('\n')
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const ABOVE = (surface: 'terminal' | 'desktop') => ({
  plugin: 'orc', surface, component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: {} as never, view: {} as never },
})
const U = { model: 'claude-sonnet-5-5', input_tokens: 40_000, output_tokens: 500, cache_read_input_tokens: 36_000, cache_creation_input_tokens: 0 }
const DONE = { turnId: 't1', answer: '', durationMs: 10, isAborted: false, reason: 'answer' as const, text: '' }

const fills: unknown[] = []
function world(on: On, opts: { session?: string } = {}) {
  on('process.run', ($, e) => {
    if (e.argv[1] === 'get') return opts.session === '' ? ran('', 1) : ran(opts.session ?? SESSION)
    if (e.argv[1] === 'slice') return ran(SLICES)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 195_000 }))
  on('agent.spawn', ($, e) => ({ model: e.model ?? 'x', agentId: 'a1', prompt: e.prompt }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: U }
  })
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('prompt.fill', ($, e) => { fills.push(e); return { value: { isFilled: true } } })
}

test('setStep and finishAgent are pure ledger updates', () => {
  const s = setStep(LEDGER_INITIAL, 'a1', { label: 'red', n: 1, of: 5 })
  expect(s.agents.a1).toMatchObject({ ...ENTRY_INITIAL, step: { label: 'red', n: 1, of: 5 } })
  expect(finishAgent(s, 'a1', 99).agents.a1.finishedAt).toBe(99)
  expect(finishAgent(s, 'nope', 99)).toBe(s)
})

test('agentRows treats finishedAt == null as running, not a 30 s window', () => {
  const e = { ...ENTRY_INITIAL, lastAt: 0, startedAt: 0 }
  const rows = agentRows({ main: e, agents: { live: e, gone: { ...e, finishedAt: 5 } } }, () => null, 10 * 60_000)
  expect(rows.map(r => [r.name, r.running])).toEqual([['live', true], ['gone', false]])
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the progress band draws on ${surface} and its next button fills the prompt`, async ($, on) => {
    world(on)
    fills.length = 0
    await $.command.run(RUN)
    const ui = await $.ui.mount(ABOVE(surface))
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /3\/7/ })).toBeDefined()
    else expect(await ui.find({ type: 'Svg', alt: /3 of 7 slices done, 2 running/ })).toBeDefined()
    expect(await ui.find({ key: 'orc-next' })).toMatchObject({ props: { hotkey: '1', label: '/orc:resume' } })
    await ui.press({ key: 'orc-next' })

    expect(fills).toMatchObject([{ text: '/orc:resume' }])
    await ui.unmount()
  })
}

test('progress_band: false leaves the engine band alone', { options: { progress_band: false } }, async ($, on) => {
  world(on)
  await $.command.run(RUN)
  const ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.drawn()).toEqual({ type: 'engine', ref: 0 })
  await ui.unmount()
})

test('no session: no progress band', async ($, on) => {
  world(on, { session: '' })
  await $.command.run(RUN)
  const ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.drawn()).toEqual({ type: 'engine', ref: 0 })
  await ui.unmount()
})

const START = { surface: 'terminal' as const, isInteractive: false, cwd: '/work' }

test('session.start registers the step tool', async ($, on) => {
  world(on)
  const registered: { name: string }[] = []
  on('command.register', () => ({ value: { command: 'orc' } }))
  on('session.start', () => ({ cwd: '/work' }))
  on('tool.register', ($, e) => { registered.push(e as never); return { value: { tool: 'mcp__orc__step' } } })
  await $.session.start(START)
  expect(registered.map(t => t.name)).toEqual(['step'])
})

test('a subagent step call lands in the ledger; a main-session call is ignored', async ($, on) => {
  world(on)
  const writes: { key?: string; value: any }[] = []
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  const call = { tool: 'mcp__orc__step' as const, tool_use_id: 't9', label: 'writing failing test', n: 2, of: 5 }
  const ignored = await $.tool.call(call)
  expect(ignored).toMatchObject({ result: 'ignored: only orc subagents report steps' })
  expect(writes.filter(w => w.key === 'ledger')).toEqual([])
  await $.tool.call({ ...call, agentId: 'a1' })
  const ledger = writes.filter(w => w.key === 'ledger').at(-1)!.value
  expect(ledger.agents.a1.step).toEqual({ label: 'writing failing test', n: 2, of: 5 })
})

test('the step brief is appended to the implementer prompt once', async ($, on) => {
  const seen: string[] = []
  on('agent.spawn', ($, e) => { seen.push(e.prompt); return { model: 'x', agentId: 'a1' } })
  on('state.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1 }))
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  expect(seen[0]).toContain('mcp__orc__step')
  await $.agent.spawn({ ...spawnOf('orc:orc-implementer'), prompt: seen[0] })
  expect(seen[1]).toBe(seen[0])
  await $.agent.spawn(spawnOf('orc:orc-planner'))
  expect(seen[2]).toBe('do the slice')
})

test('a finished orc agent is stamped, not guessed from a clock', async ($, on) => {
  world(on)
  const writes: { key?: string; value: any }[] = []
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  expect(writes.filter(w => w.key === 'ledger').at(-1)!.value.agents.a1.finishedAt).toBeNull()
  await $.turn.complete({ ...DONE, agentId: 'a1' })
  expect(writes.filter(w => w.key === 'ledger').at(-1)!.value.agents.a1.finishedAt).toBe(195_000)
})

const PANE = {
  plugin: 'orc', component: 'Pane', requestId: 'orc-cockpit', viewport: { columns: 120, rows: 40 },
  props: { title: 'orc', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the cockpit Agents section draws live agent rows on ${surface}`, async ($, on) => {
    world(on)
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await $.command.run(RUN)
    await $.agent.spawn(spawnOf('orc:orc-implementer'))
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 2, agentId: 'a1' })
    for await (const _ of stream) { /* drain */ }
    await $.tool.call({ tool: 'mcp__orc__step', tool_use_id: 't9', label: 'writing failing test', n: 2, of: 5, agentId: 'a1' })
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'sec-agents' })
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /orc-implementer.*writing failing test 2\/5.*ctx 38%/ })).toBeDefined()
    else expect(await ui.find({ type: 'Svg', alt: /orc-implementer.*writing failing test 2\/5/ })).toBeDefined()
    await ui.unmount()
  })
}
