import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { HAIKU } from '../retro/prompt'
import { parseSentinel } from '../sentinel/prompt'
import { flush, ran, spawnOf } from './helpers'

// --- pure ---
test('parseSentinel strips a ``` or ```json fence before the strict parse', () => {
  const v = { headsUp: 'No test covers this', kind: 'untested' }
  expect(parseSentinel(JSON.stringify(v))).toEqual(v)
  expect(parseSentinel('```json\n' + JSON.stringify(v) + '\n```')).toEqual(v)
  expect(parseSentinel('```\n' + JSON.stringify(v) + '\n```\n')).toEqual(v)
  expect(parseSentinel('```json\nnot json\n```')).toBeNull()
})

// --- engine ---
const session = (phase: number) => JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase, phaseLabel: 'implement', totalPhases: 9 })
const SLICES = '1\tcommitted\ta\tabc\n2\tgreen\tb\t-\n3\tpending\tc\t-\n'
const PLAN = JSON.stringify({ schema: 1, slices: [{ id: 2, title: 'b', touchpoints: ['src/b.ts', 'tests/b.test.ts'], acceptance: ['POST /export returns 202'] }] })
const PLAN_PATH = '/state/feat-export/files/slices.json'
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const ABOVE = (surface: 'terminal' | 'desktop') => ({
  plugin: 'orc', surface, component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: {} as never, view: {} as never },
})
const USAGE = { model: HAIKU, input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const verdict = (headsUp: string | null = 'No test covers the new export', kind: string | null = 'untested') => JSON.stringify({ headsUp, kind })

type W = { completes: any[]; fills: any[]; store: Map<string, unknown>; reply: { text: string }; gate: { p: Promise<void> | null }; opts: { phase: number; loc: number; diff: string } }
function world(on: On, o: Partial<W['opts']> = {}) {
  const w: W = { completes: [], fills: [], store: new Map(), reply: { text: verdict() }, gate: { p: null }, opts: { phase: 5, loc: 10, diff: '+++ b/src/b.ts\n+export const x = 1', ...o } }
  const clock = mock.clock(on, { now: 1_000_000 })
  on('process.run', ($, e) => {
    const bin = String(e.argv[0]).split('/').pop()
    if (bin === 'git') {
      if (e.argv.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      if (e.argv.includes('--abbrev-ref')) return ran('origin/main\n')
      if (e.argv.includes('merge-base')) return ran('deadbeef\n')
      if (e.argv.includes('diff')) return ran(w.opts.diff)
      return ran('')
    }
    if (bin === 'orc-pr-size') return ran(e.argv[1] === 'loc' ? String(w.opts.loc) : '300')
    if (e.argv[1] === 'get') return ran(session(w.opts.phase))
    if (e.argv[1] === 'slice') return ran(SLICES)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('session.id', () => ({ value: 's1' }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('fs.read', ($, e) => { if (e.path !== PLAN_PATH) throw new Error('ENOENT'); return { value: PLAN } })
  on('store.get', ($, e) => ({ value: w.store.get(e.key) }))
  on('store.set', ($, e) => { w.store.set(e.key, e.value); return { value: undefined } })
  on('prompt.fill', ($, e) => { w.fills.push(e); return { value: { isFilled: true } } })
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('ui.toast', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'a1' }))
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { ...USAGE, model: 'claude-sonnet-5-5' } }
  })
  on('model.complete', async ($, e) => {
    w.completes.push(e)
    if (w.gate.p) await w.gate.p
    return { value: { isAnswered: true as const, text: w.reply.text, usage: USAGE } } as never
  })
  on('tool.call', ($, e) => ((e as any).command?.includes('FAIL') ? { isError: true as const, result: 'exit 1' } : ({ result: { type: 'text', file: {} } } as never)))
  mock.env(on, { ORC_STATE_DIR: '/state' })
  return Object.assign(w, { clock })
}

const edit = ($: any, file: string) => $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: file, old_string: 'x', new_string: 'y' })
const done = (agentId?: string) => ({ turnId: 't1', answer: 'ok', durationMs: 5, isAborted: false, reason: 'answer' as const, ...(agentId ? { agentId } : {}) })
async function steps($: any, w: { clock: { advance(ms: number): Promise<void>; settle(): Promise<void> } }, n: number, agentId = 'a1') {
  for (let i = 0; i < n; i++) for await (const _ of $.turn.step({ turnId: 't1', index: i, model: 'm', messageCount: 2, agentId })) { /* drain */ }
  await w.clock.advance(5)
  for (let i = 0; i < 4; i++) { await w.clock.settle(); await flush(200) }
}
const mountBand = ($: any, surface: 'terminal' | 'desktop' = 'terminal') => $.ui.mount(ABOVE(surface))
const HEADS_UP = /✦ heads up/

for (const surface of ['terminal', 'desktop'] as const) {
  test(`an edit outside the slice's files shows the sentinel row on ${surface}`, async ($, on) => {
    const w = world(on)
    await $.command.run(RUN)
    await edit($, '/w/src/z.ts')
    const ui = await mountBand($, surface)
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: HEADS_UP })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Edited outside this slice's files: src\/z\.ts/ })).toBeDefined()
    } else expect(await ui.find({ type: 'Svg', alt: /Heads up: Edited outside this slice's files: src\/z\.ts/ })).toBeDefined()
    expect(await ui.find({ key: 'sentinel-dismiss' })).toMatchObject({ props: { label: 'Dismiss', hotkey: '0' } })
    expect(w.completes).toEqual([])
    await ui.unmount()
  })
}

test('an edit inside the slice (or a test beside its tests) raises nothing', async ($, on) => {
  world(on)
  await $.command.run(RUN)
  await edit($, '/w/src/b.ts')
  await edit($, '/w/tests/other.test.ts')
  const ui = await mountBand($)
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  await ui.unmount()
})

test('a main turn.complete runs the budget check', async ($, on) => {
  world(on, { loc: 500 })
  await $.command.run(RUN)
  await $.turn.complete(done())
  const ui = await mountBand($)
  expect(await ui.find({ type: 'Text', text: /Projected 1500 LOC at this pace vs budget 300/ })).toBeDefined()
  await ui.unmount()
})

test('the same failing test command three times in a row raises a note on the next turn.complete', async ($, on) => {
  world(on)
  await $.command.run(RUN)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', tool_use_id: 'b' + i, command: 'npm test FAIL' })
  await $.turn.complete(done())
  const ui = await mountBand($)
  expect(await ui.find({ type: 'Text', text: /failed 3 times in a row/ })).toBeDefined()
  await ui.unmount()
})

test('Dismiss hides the note and remembers its id per branch', async ($, on) => {
  const w = world(on)
  await $.command.run(RUN)
  await edit($, '/w/src/z.ts')
  const ui = await mountBand($)
  await ui.press({ key: 'sentinel-dismiss' })
  await flush(200)
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  expect(w.store.get('sentinel:dismissed:feat-export')).toEqual(['outside-slice:src/z.ts'])
  await edit($, '/w/src/z.ts')
  await $.turn.complete(done())
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  await ui.unmount()
})

test('a problem that is fixed clears the row on the next turn.complete', async ($, on) => {
  const w = world(on, { loc: 500 })
  await $.command.run(RUN)
  await $.turn.complete(done())
  w.opts.loc = 10
  await $.turn.complete(done())
  const ui = await mountBand($)
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  await ui.unmount()
})

test('no note outside phase 5', async ($, on) => {
  world(on, { phase: 6 })
  await $.command.run(RUN)
  await edit($, '/w/src/z.ts')
  await $.turn.complete(done())
  const ui = await mountBand($)
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  await ui.unmount()
})

test('sentinel: off shows nothing', { options: { sentinel: 'off' } }, async ($, on) => {
  world(on)
  await $.command.run(RUN)
  await edit($, '/w/src/z.ts')
  const ui = await mountBand($)
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  await ui.unmount()
})

test('sentinel: checks never calls the model', { options: { sentinel: 'checks', sentinel_every: 4 } }, async ($, on) => {
  const w = world(on)
  await $.command.run(RUN)
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  await steps($, w, 8)
  expect(w.completes).toEqual([])
})

test('every sentinel_every steps of an orc agent, one Haiku review of the slice and its diff', { options: { sentinel_every: 4 } }, async ($, on) => {
  const w = world(on)
  await $.command.run(RUN)
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  await steps($, w, 3)
  expect(w.completes).toEqual([])
  await steps($, w, 1)
  expect(w.completes).toHaveLength(1)
  expect(w.completes[0]).toMatchObject({ model: HAIKU, maxTokens: 400, timeoutMs: 20_000 })
  expect(w.completes[0].prompt).toContain('POST /export returns 202')
  expect(w.completes[0].prompt).toContain('src/b.ts')
  expect(w.completes[0].prompt).toContain('+export const x = 1')
  const ui = await mountBand($)
  expect(await ui.find({ type: 'Text', text: /No test covers the new export/ })).toBeDefined()
  await ui.unmount()
})

test('a fenced reply parses; a null heads-up or junk adds no row; non-orc agents are not counted', { options: { sentinel_every: 4 } }, async ($, on) => {
  const w = world(on)
  await $.command.run(RUN)
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  w.reply.text = verdict(null, null)
  await steps($, w, 4)
  w.reply.text = 'sorry, no'
  await steps($, w, 4)
  expect(w.completes).toHaveLength(2)
  let ui = await mountBand($)
  expect(await ui.findAll({ type: 'Text', text: HEADS_UP })).toEqual([])
  await ui.unmount()
  w.reply.text = '```json\n' + verdict('Drifting from the plan', 'drift') + '\n```'
  await steps($, w, 4)
  ui = await mountBand($)
  expect(await ui.find({ type: 'Text', text: /Drifting from the plan/ })).toBeDefined()
  await ui.unmount()
  await steps($, w, 8, 'stranger')
  expect(w.completes).toHaveLength(3)
})

test('never more than one review in flight', { options: { sentinel_every: 4 } }, async ($, on) => {
  const w = world(on)
  await $.command.run(RUN)
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  let open!: () => void
  w.gate.p = new Promise<void>(res => { open = res })
  await steps($, w, 12)
  expect(w.completes).toHaveLength(1)
  open()
  w.gate.p = null
  await flush(500)
  await steps($, w, 4)
  expect(w.completes).toHaveLength(2)
})

test('Learn more asks once more (120 words) and expands the card; Chat in main session fills the prompt', { options: { sentinel_every: 4 } }, async ($, on) => {
  const w = world(on)
  await $.command.run(RUN)
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  await steps($, w, 4)
  const ui = await mountBand($)
  w.reply.text = 'The export handler has no test, so a regression would ship unnoticed.'
  await ui.press({ key: 'sentinel-learn' })
  await flush(300)
  expect(w.completes).toHaveLength(2)
  expect(w.completes[1]).toMatchObject({ model: HAIKU, timeoutMs: 20_000 })
  expect(w.completes[1].prompt).toContain('120 words')
  expect(w.completes[1].prompt).toContain('No test covers the new export')
  expect(await ui.find({ type: 'Text', text: /no test, so a regression/ })).toBeDefined()
  await ui.press({ key: 'sentinel-chat' })
  expect(w.fills).toMatchObject([{ text: 'Sentinel note on slice 2: No test covers the new export — please check.' }])
  await ui.unmount()
})
