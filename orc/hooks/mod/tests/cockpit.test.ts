import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const SESSION = JSON.stringify({
  command: 'flow', gitBranch: 'feat/export', description: 'CSV export', status: 'in_progress',
  phase: 5, phaseLabel: 'implement', totalPhases: 9, jiraTicket: null,
})
const SLICES = '1\tcommitted\tstream rows\tabc1234\n2\tpending\texport job\t-\n3\tred\tdownload button\t-\n'
const DECISIONS = JSON.stringify({ schema: 1, decisions: { autopilotLevel: { value: 'guided', provenance: 'flag' } } })

const REPORT = JSON.stringify({ verdict: 'fail', missing: ['qa-feat-export.webm'], acceptance: [
  { criterion: 'POST /export returns 202', result: 'pass', note: '', sliceId: 1 },
  { criterion: 'Download shows progress', result: 'fail', note: 'bar never renders', sliceId: 1 }] })
const USAGE = JSON.stringify([{ agent: 'orc-implementer', runs: 3, in: 52000, out: 9100, ms: 184000 }])

const result = (stdout: string, exitCode = 0) => ({
  value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

// Answer each orc-state verb the cockpit runs; record every argv.
function orcState(calls: string[][], session = SESSION) {
  return ($: unknown, e: { argv: readonly string[] }) => {
    calls.push([...e.argv])
    const verb = e.argv[1]
    const bin = String(e.argv[0]).split('/').pop()
    if (bin === 'orc-report') return result(REPORT)
    if (bin === 'orc-pr-size') return result(verb === 'loc' ? '412' : '300')
    if (verb === 'usage') return result(USAGE)
    if (verb === 'get') return session ? result(session) : result('', 1)
    if (verb === 'slice') return result(SLICES)
    if (verb === 'decision' && e.argv[2] === 'get') return result(DECISIONS)
    return result('')
  }
}

// What the engine passes when the user types /orc at the prompt.
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }

const PANE = {
  plugin: 'orc', component: 'Pane', requestId: 'orc-cockpit',
  viewport: { columns: 120, rows: 40 },
  props: { title: 'orc', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('/orc answers with a text summary where no surface draws (claude -p)', async ($, on) => {
  on('process.run', orcState([]))
  on('session.surfaces', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const out = await $.command.run(RUN)
  expect(out.text).toContain('flow 5/9 implement · slices 1/3 · policy guided · feat/export')
  expect(out.text).toContain('#3 red')
})

test('/orc without a session says how to start one', async ($, on) => {
  on('process.run', orcState([], ''))
  on('session.surfaces', () => ({ value: [] }))
  const out = await $.command.run(RUN)
  expect(out.text).toContain('No orc session on this branch')
})

const USAGE_METER = { startedAt: 0, context: { window: 200000, tokens: 84000, percent: 42 }, rateLimits: [], cost: { usd: 0.4211 } }

function surfaces(on: On, list: ('terminal' | 'desktop')[]) {
  const opened: unknown[] = []
  on('session.surfaces', () => ({ value: list }))
  on('session.usage', () => ({ value: USAGE_METER }))
  on('ui.open', ($, e) => { opened.push(e); return { value: { isPlaced: true } } })
  return opened
}

test('the dashboard draws the ladder and the ledger together, with the meter in the header', async ($, on) => {
  on('process.run', orcState([]))
  const opened = surfaces(on, ['terminal'])
  await $.command.run(RUN)
  expect(opened[0]).toMatchObject({ id: 'orc-cockpit', rows: 16, columns: 76 })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, placement: 'dock', bodyColumns: 120 } })
  expect(await ui.find({ type: 'Text', text: /ctx 42%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\$0\.42/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /profile balanced/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▶ 5 implement' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /#3 red\s+download button/ })).toBeDefined()
  expect(await ui.find({ key: 'refresh' })).toBeUndefined()
  expect(await ui.find({ key: 'resume' })).toBeDefined()
  await ui.unmount()
})

test('a narrow inline pane stacks the ladder over the ledger', async ($, on) => {
  on('process.run', orcState([]))
  surfaces(on, ['terminal'])
  await $.command.run(RUN)
  const narrow = { ...PANE, props: { ...PANE.props, placement: 'inline' as const, bodyColumns: 60 } }
  const ui = await $.ui.mount({ ...narrow, surface: 'terminal' })
  const drawn = await ui.drawn()
  // Root: column -> [header, body, ...]; body is a column Box when narrow, a row Box when wide.
  const body = (drawn as { children?: { type: string; props?: Record<string, unknown> }[] }).children?.[1]
  expect(body?.props?.flexDirection).toBe('column')
  await ui.unmount()
})

test('a pane the terminal cannot place falls back to text', async ($, on) => {
  on('process.run', orcState([]))
  on('session.surfaces', () => ({ value: ['terminal' as const] }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'terminal too narrow' } }))
  const out = await $.command.run(RUN)
  expect(out.text).toContain('flow 5/9 implement')
})
