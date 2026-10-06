import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { ran, spawnOf } from './helpers'

const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 })
const GUIDED = JSON.stringify({ schema: 1, decisions: { autopilotLevel: { value: 'guided', provenance: 'flag' } } })
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }

// The beneath render stub plays core: it records the props the plugin handed down.
function world(on: On, opts: { session?: string; decisions?: string } = {}) {
  const seen: Record<string, unknown>[] = []
  on('process.run', ($, e) => {
    if (e.argv[1] === 'get') return opts.session === '' ? ran('', 1) : ran(opts.session ?? SESSION)
    if (e.argv[1] === 'decision') return ran(opts.decisions ?? '')
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1000 }))
  on('agent.spawn', ($, e) => ({ model: e.model ?? 'x', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', ($, e) => { seen.push(e.props as Record<string, unknown>); return { type: 'engine' as const, ref: 0 } })
  return seen
}

const SPINNER = { plugin: 'orc', surface: 'terminal' as const, component: 'Spinner' as const, props: { word: 'Thinking', message: null, suffix: '', mode: 'thinking' as const } }
const HINT = { plugin: 'orc', surface: 'terminal' as const, component: 'PromptHint' as const, props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } }
const MODE = { plugin: 'orc', surface: 'terminal' as const, component: 'SessionMode' as const, props: { modes: ['focus'] } }
const done = { turnId: 't1', answer: '', durationMs: 10, isAborted: false, reason: 'answer' as const, text: '', usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }

test('the spinner carries the phase, and the running orc agent while one runs', async ($, on) => {
  const seen = world(on)
  await $.command.run(RUN)
  await (await $.ui.mount(SPINNER)).unmount()
  expect(seen.at(-1)?.suffix).toBe(' · orc flow 5/9 implement')
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  await (await $.ui.mount(SPINNER)).unmount()
  expect(seen.at(-1)?.suffix).toBe(' · orc flow 5/9 implement · implementer')
  await $.turn.complete({ ...done, agentId: 'a1' })
  await (await $.ui.mount(SPINNER)).unmount()
  expect(seen.at(-1)?.suffix).toBe(' · orc flow 5/9 implement')
})

test('the prompt hint names the flow when idle and is untouched while working', async ($, on) => {
  const seen = world(on)
  await $.command.run(RUN)
  await (await $.ui.mount(HINT)).unmount()
  expect(seen.at(-1)?.hint).toBe('orc flow 5/9 implement · /orc cockpit · /orc:resume')
  await (await $.ui.mount({ ...HINT, props: { ...HINT.props, isWorking: true } })).unmount()
  expect(seen.at(-1)?.hint).toBe('? for shortcuts')
})

test('the mode footer shows a non-manual policy', async ($, on) => {
  const seen = world(on, { decisions: GUIDED })
  await $.command.run(RUN)
  await (await $.ui.mount(MODE)).unmount()
  expect(seen.at(-1)?.modes).toEqual(['focus', 'orc guided'])
})

test('with no session every surface passes through', async ($, on) => {
  const seen = world(on, { session: '' })
  await $.command.run(RUN)
  await (await $.ui.mount(SPINNER)).unmount()
  await (await $.ui.mount(HINT)).unmount()
  await (await $.ui.mount(MODE)).unmount()
  expect(seen.map(p => p.suffix ?? p.hint ?? p.modes)).toEqual(['', '? for shortcuts', ['focus']])
})

const TOOL = (command: string, extra: Partial<{ isRunning: boolean; isErrored: boolean }> = {}) => ({
  plugin: 'orc', surface: 'terminal' as const, component: 'ToolUse' as const, requestId: 't1',
  props: { tool_use_id: 't1', tool: 'Bash', input: { command }, isRunning: false, isErrored: false, isInterrupted: false, ...extra },
})

test('orc plumbing rows collapse to one dim line; errors and other commands keep the engine row', async ($, on) => {
  world(on)
  const row = async (m: ReturnType<typeof TOOL>) => { const ui = await $.ui.mount(m); const t = await ui.find({ type: 'Text' }); const d = await ui.drawn(); await ui.unmount(); return { t, d } }
  expect((await row(TOOL('orc-state slice set 3 --status committed --commit abc1234'))).t?.text).toBe('○ orc · orc-state slice set 3 --status committed --commit abc1234')
  expect((await row(TOOL('gh pr checks 12 --json name,bucket', { isRunning: true }))).t?.text).toBe('○ orc · gh pr checks 12 --json name,bucket …')
  expect((await row(TOOL('/x/bin/orc-state get'))).t?.text).toBe('○ orc · /x/bin/orc-state get')
  expect((await row(TOOL('orc-pr-size loc'))).t?.text).toBe('○ orc · orc-pr-size loc')
  expect((await row(TOOL('orc-report json'))).t?.text).toBe('○ orc · orc-report json')
  expect((await row(TOOL('orc-state get', { isErrored: true }))).d).toEqual({ type: 'engine', ref: 0 })
  expect((await row(TOOL('ls -la'))).d).toEqual({ type: 'engine', ref: 0 })
})
