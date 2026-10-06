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

test('the pane shows the phase ladder, then the slice ledger', async ($, on) => {
  on('process.run', orcState([]))
  on('session.surfaces', () => ({ value: ['terminal' as const] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const out = await $.command.run(RUN)
  expect(out.text).toBeUndefined()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '▶ 5 implement' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ 4' })).toBeDefined()
  await ui.press({ key: 'tab-slices' })
  expect(await ui.find({ type: 'Text', text: /#3 red\s+download button/ })).toBeDefined()
  await ui.unmount()
})

test('picking a policy settles it through orc-state as an asked decision', async ($, on) => {
  const calls: string[][] = []
  on('process.run', orcState(calls))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-decisions' })
  await ui.press({ key: 'policy-auto' })
  const write = calls.find(argv => argv[1] === 'decision' && argv[2] === 'set')
  expect(write?.slice(1)).toEqual(['decision', 'set', 'autopilotLevel', 'auto', '--provenance', 'asked', '--supersede'])
  await ui.unmount()
})

test('a pane the terminal cannot place falls back to text', async ($, on) => {
  on('process.run', orcState([]))
  on('session.surfaces', () => ({ value: ['terminal' as const] }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'terminal too narrow' } }))
  const out = await $.command.run(RUN)
  expect(out.text).toContain('flow 5/9 implement')
})

test('QA, PR and Agents tabs draw the report, the size budget, and the usage ledger', async ($, on) => {
  on('process.run', orcState([]))
  on('session.surfaces', () => ({ value: ['terminal' as const] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-qa' })
  expect(await ui.find({ type: 'Text', text: 'Verdict: FAIL' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ POST /export returns 202  (slice 1)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✗ Download shows progress  (slice 1) — bar never renders' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Missing evidence: qa-feat-export.webm' })).toBeDefined()
  await ui.press({ key: 'tab-pr' })
  expect(await ui.find({ type: 'Text', text: /412\/300 LOC — over by 112$/ })).toBeDefined()
  await ui.press({ key: 'tab-agents' })
  expect(await ui.find({ type: 'Text', text: /orc-implementer\s+3 runs\s+52\.0k in \/ 9\.1k out\s+184s/ })).toBeDefined()
  await ui.unmount()
})
