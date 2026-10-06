import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { ran } from './helpers'

const SESSION = JSON.stringify({
  command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', description: 'CSV export', status: 'in_progress',
  phase: 5, phaseLabel: 'implement', totalPhases: 9, jiraTicket: null,
  linkedPRs: [{ url: 'https://github.com/acme/app/pull/12', number: 12 }],
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

test('sections start collapsed, mark attention, and toggle', async ($, on) => {
  on('process.run', orcState([]))
  surfaces(on, ['terminal'])
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'sec-qa' })).toMatchObject({ props: { label: '▸ QA !' } })
  expect(await ui.find({ key: 'sec-pr' })).toMatchObject({ props: { label: '▸ PR !' } })
  expect(await ui.find({ key: 'sec-agents' })).toMatchObject({ props: { label: '▸ Agents' } })
  expect(await ui.find({ type: 'Text', text: /POST \/export returns 202/ })).toBeUndefined()
  await ui.press({ key: 'sec-qa' })
  expect(await ui.find({ key: 'sec-qa' })).toMatchObject({ props: { label: '▾ QA !' } })
  expect(await ui.find({ type: 'Text', text: /✓ POST \/export returns 202/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✗ Download shows progress/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Verdict: FAIL' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Missing evidence: qa-feat-export.webm' })).toBeDefined()
  await ui.press({ key: 'sec-qa' })
  expect(await ui.find({ type: 'Text', text: /POST \/export returns 202/ })).toBeUndefined()
  await ui.press({ key: 'sec-pr' })
  expect(await ui.find({ type: 'Link' })).toMatchObject({ props: { href: 'https://github.com/acme/app/pull/12' } })
  expect(await ui.find({ type: 'Text', text: /412\/300 LOC — over by 112$/ })).toBeDefined()
  await ui.press({ key: 'sec-agents' })
  expect(await ui.find({ type: 'Text', text: /orc-implementer\s+3 runs\s+52\.0k in \/ 9\.1k out\s+184s/ })).toBeDefined()
  await ui.unmount()
})

test('the Decisions selects settle policy and profile through orc-state as asked decisions', async ($, on) => {
  const calls: string[][] = []
  on('process.run', orcState(calls))
  surfaces(on, ['desktop'])
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'sec-decisions' })
  await ui.select({ key: 'policy', value: 'auto' })
  const policy = calls.find(a => a[1] === 'decision' && a[2] === 'set')
  expect(policy?.slice(1)).toEqual(['decision', 'set', 'autopilotLevel', 'auto', '--provenance', 'asked', '--supersede'])
  await ui.select({ key: 'profile', value: 'economy' })
  const profile = calls.filter(a => a[1] === 'decision' && a[2] === 'set').at(-1)
  expect(profile?.slice(3)).toEqual(['modelProfile', 'economy', '--provenance', 'asked', '--supersede'])
  const before = calls.length
  await ui.select({ key: 'policy', value: 'guided' }) // already current (DECISIONS fixture says guided)
  expect(calls.length).toBe(before)
  await ui.unmount()
})

test('digest and diff sections load on open', async ($, on) => {
  const calls: string[][] = []
  const reads: string[] = []
  on('process.run', ($, e) => {
    if (e.argv[0] === 'git') { calls.push([...e.argv]); return ran('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n') }
    return orcState(calls)($, e)
  })
  on('fs.read', ($, e) => { reads.push(e.path); return { value: '# x\n\n## Resume digest\nPhase 5.\n' } })
  on('env.get', () => ({ value: undefined }))
  surfaces(on, ['terminal'])
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sec-digest' })
  expect(reads.length).toBe(1)
  expect(reads[0]).toMatch(/\/\.orc\/feat-export\/files\/checkpoint\.md$/)
  expect(await ui.find({ type: 'Markdown' })).toMatchObject({ props: { text: 'Phase 5.' } })
  await ui.press({ key: 'sec-diff' })
  // SLICES fixture: #1 committed, #2 pending, so the current slice is #2, uncommitted.
  expect(calls.find(a => a[0] === 'git' && a[1] !== 'rev-parse')).toEqual(['git', 'diff', '--no-color', '-U1'])
  expect(await ui.find({ type: 'Code' })).toMatchObject({ props: { format: 'diff' } })
  await ui.unmount()
})

test('an open digest section survives a refresh, and the diff shows the last commit once all slices are done', async ($, on) => {
  const calls: string[][] = []
  let reads = 0
  const ALL_DONE = '1\tcommitted\tstream rows\tabc1234\n2\tcommitted\texport job\tdef5678\n'
  on('process.run', ($, e) => {
    if (e.argv[0] === 'git') { calls.push([...e.argv]); return e.argv[1] === 'rev-parse' ? ran('/repo') : ran('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n') }
    if (e.argv[1] === 'slice') return ran(ALL_DONE)
    return orcState(calls)($, e)
  })
  on('fs.read', ($, e) => { reads += 1; return { value: e.path === '/repo/.orc/feat-export/files/checkpoint.md' ? '## Resume digest\nPhase 5.\n' : '' } })
  on('env.get', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  surfaces(on, ['terminal'])
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sec-digest' })
  expect(await ui.find({ type: 'Markdown' })).toMatchObject({ props: { text: 'Phase 5.' } })
  // A main-loop turn ends: the snapshot refreshes and the open section reloads instead of sticking on "Loading…".
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' as const,
    usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } })
  expect(reads).toBe(2)
  expect(await ui.find({ type: 'Markdown' })).toMatchObject({ props: { text: 'Phase 5.' } })
  await ui.press({ key: 'sec-diff' })
  expect(calls.find(a => a[0] === 'git' && a[1] === 'show')).toEqual(['git', 'show', '--no-color', '--format=', '-U1', 'def5678'])
  expect(await ui.find({ type: 'Text', text: /Slice #2 export job · def5678/ })).toBeDefined()
  await ui.unmount()
})
