// Review fixes in register.ts: serialized ledger/touched writes, retro file safety, sentinel guards, refresh cost.
import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { renderRules } from '../retro/store'
import { SENTINEL_SYSTEM } from '../sentinel/prompt'
import { flush, ran, spawnOf } from './helpers'

const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-x', gitBranch: 'feat/x', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 })
const SLICES = '1\tcommitted\ta\tabc\n2\tgreen\tb\t-\n3\tpending\tc\t-\n'
const RUN = (args = '') => ({ command: 'orc', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } })
const START = { surface: 'terminal' as const, isInteractive: false, cwd: '/work' }
const ABOVE = {
  plugin: 'orc', surface: 'terminal' as const, component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: {} as never, view: {} as never },
}
const USAGE = { model: 'claude-haiku-4-5-20251001', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const DONE = { turnId: 't1', answer: 'ok', durationMs: 5, isAborted: false, reason: 'answer' as const }

// --- W2: parallel hooks must not lose ledger / touched updates ---
function base(on: On, gate?: { p: Promise<void> | null }) {
  on('process.run', async ($, e) => {
    if (gate && (e as { cwd?: string }).cwd && String(e.argv[0]).endsWith('orc-pr-size')) { if (gate.p) await gate.p; return ran('10') }
    if (e.argv[0] === 'git') {
      if (e.argv.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      if (e.argv.includes('--abbrev-ref')) return ran('origin/main\n')
      if (e.argv.includes('merge-base')) return ran('deadbeef\n')
      return ran('')
    }
    if (e.argv[1] === 'get') return ran(SESSION)
    if (e.argv[1] === 'slice') return ran(SLICES)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 100_000 }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
}

test('W2: two agents spawning at once both land in the ledger', async ($, on) => {
  base(on)
  const writes: { key?: string; value: any }[] = []
  let n = 0
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  on('agent.spawn', () => ({ model: 'x', agentId: 'a' + ++n }))
  await Promise.all([$.agent.spawn(spawnOf('orc:orc-implementer')), $.agent.spawn(spawnOf('orc:orc-reviewer'))])
  const last = writes.filter(w => w.key === 'ledger').at(-1)!.value
  expect(Object.keys(last.agents).sort()).toEqual(['a1', 'a2'])
})

test('W2: two Reads at once both land in the touched list', async ($, on) => {
  base(on)
  const writes: { key?: string; value: any }[] = []
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  on('tool.call', () => ({ result: { type: 'text', file: {} } }) as never)
  await $.command.run(RUN())
  await Promise.all([
    $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/w/src/a.ts' }),
    $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: '/w/src/b.ts' }),
  ])
  await flush(100)
  const last = writes.filter(w => w.key === 'touched').at(-1)!.value
  expect(last.files.map((f: any) => f.path).sort()).toEqual(['src/a.ts', 'src/b.ts'])
})

// --- W1: the step brief only goes out when the tool registered ---
test('W1: no step brief when the step tool could not register', async ($, on) => {
  const seen: string[] = []
  on('agent.spawn', ($, e) => { seen.push(e.prompt); return { model: 'x', agentId: 'a1' } })
  on('state.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1 }))
  on('process.run', () => ran('', 1))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.start', () => ({ cwd: '/work' }))
  on('tool.register', () => { throw new Error('no tools in this build') })
  await $.session.start(START)
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  expect(seen[0]).toBe('do the slice')
})

// --- W5 / W7 / W8: retro files ---
const CANDIDATES = '/state/retro/candidates.json'
const RULES = '/state/retro/rules.md'
type Files = { files: Map<string, string>; unreadable: Set<string>; writes: string[] }
function retroWorld(on: On): Files {
  mock.env(on, { ORC_STATE_DIR: '/state' })
  mock.clock(on, { now: 1_000_000 })
  const w: Files = { files: new Map(), unreadable: new Set(), writes: [] }
  on('process.run', ($, e) => (e.argv[1] === 'get' ? ran(SESSION) : ran('')))
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: { command: 'orc' } }))
  on('session.id', () => ({ value: 's1' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('fs.read', ($, e) => {
    if (w.unreadable.has(e.path)) throw new Error('EACCES')
    if (!w.files.has(e.path) && !w.unreadable.has(e.path)) throw new Error('ENOENT')
    return { value: w.files.get(e.path) as string }
  })
  on('fs.stat', ($, e) => {
    if (!w.files.has(e.path) && !w.unreadable.has(e.path)) throw new Error('ENOENT')
    return { value: { mtimeMs: 1, size: 0, kind: 'file' as const } }
  })
  on('fs.write', ($, e) => { w.writes.push(e.path); w.files.set(e.path, e.text); return { value: undefined } })
  return w
}
const candidate = (rule: string, status = 'pending') => ({ id: 'c-' + rule.length, rule, status, seen: 1, at: 1, source: 'composer' })

test('W5: rules.md is the source of truth; a candidate saved earlier but removed from the file is not re-added', async ($, on) => {
  const w = retroWorld(on)
  w.files.set(CANDIDATES, JSON.stringify({ schema: 1, items: [candidate('Old rule the user deleted', 'saved')] }))
  w.files.set(RULES, renderRules(['Kept rule']))
  await $.session.start(START)
  const r = await $.command.run(RUN('retro save "Use pnpm"')) as { text: string }
  expect(r.text).toContain('Saved')
  expect(w.files.get(RULES)).toBe(renderRules(['Kept rule', 'Use pnpm']))
})

test('W7: an unparseable candidates.json refuses the save and is left untouched', async ($, on) => {
  const w = retroWorld(on)
  w.files.set(CANDIDATES, '{ not json')
  await $.session.start(START)
  const r = await $.command.run(RUN('retro save "Use pnpm"')) as { text: string }
  expect(r.text).toContain('retro/candidates.json is unreadable — fix or delete it')
  expect(w.writes).toEqual([])
  expect(w.files.get(CANDIDATES)).toBe('{ not json')
  expect(((await $.command.run(RUN('retro'))) as { text: string }).text).toContain('unreadable')
})

test('W7: a missing candidates.json is just empty', async ($, on) => {
  const w = retroWorld(on)
  await $.session.start(START)
  const r = await $.command.run(RUN('retro save "Use pnpm"')) as { text: string }
  expect(r.text).toContain('Saved')
  expect(w.files.get(RULES)).toBe(renderRules(['Use pnpm']))
})

test('W8: a rules.md that exists but cannot be read is never overwritten', async ($, on) => {
  const w = retroWorld(on)
  w.unreadable.add(RULES)
  await $.session.start(START)
  const r = await $.command.run(RUN('retro save "Use pnpm"')) as { text: string }
  expect(r.text).toContain('not saved')
  expect(w.writes).toEqual([])
})

// --- W10: refresh does not wait for the heavy loaders ---
test('W10: turn.complete does not wait for the open radius section to load', async ($, on) => {
  const gate: { p: Promise<void> | null } = { p: null }
  base(on, gate)
  on('turn.complete', () => ({ text: '' }))
  await $.command.run(RUN('radius')) // opens the section; this load is allowed to wait
  let release: () => void = () => undefined
  gate.p = new Promise<void>(r => { release = r })
  let finished = false
  const p = $.turn.complete(DONE).then(() => { finished = true })
  await flush(300)
  expect(finished).toBe(true)
  release()
  await p
})

// --- Sentinel: system line, wrapped learn text, one learn at a time, stale model card ---
const PLAN_PATH = '/state/feat-x/files/slices.json'
const PLAN = JSON.stringify({ slices: [{ id: 2, title: 'b', touchpoints: ['src/b.ts'], acceptance: ['POST /export returns 202'] }] })
function sentinelWorld(on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { ORC_STATE_DIR: '/state' })
  const w = { completes: [] as any[], slices: SLICES, gate: { p: null as Promise<void> | null }, store: new Map<string, unknown>() }
  on('process.run', ($, e) => {
    const bin = String(e.argv[0]).split('/').pop()
    if (bin === 'git') {
      if (e.argv.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      if (e.argv.includes('--abbrev-ref')) return ran('origin/main\n')
      if (e.argv.includes('merge-base')) return ran('deadbeef\n')
      if (e.argv.includes('diff')) return ran('+++ b/src/b.ts\n+export const x = 1')
      return ran('')
    }
    if (bin === 'orc-pr-size') return ran(e.argv[1] === 'loc' ? '10' : '300')
    if (e.argv[1] === 'get') return ran(SESSION)
    if (e.argv[1] === 'slice') return ran(w.slices)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('session.id', () => ({ value: 's1' }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('fs.read', ($, e) => { if (e.path !== PLAN_PATH) throw new Error('ENOENT'); return { value: PLAN } })
  on('store.get', ($, e) => ({ value: w.store.get(e.key) }))
  on('store.set', ($, e) => { w.store.set(e.key, e.value); return { value: undefined } })
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
    const text = e.prompt.includes('120 words') ? 'It means X.' : JSON.stringify({ headsUp: 'No test covers the new export', kind: 'untested' })
    return { value: { isAnswered: true as const, text, usage: USAGE } } as never
  })
  return Object.assign(w, { clock })
}
async function review($: any, w: { clock: { advance(ms: number): Promise<void>; settle(): Promise<void> } }) {
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  for (let i = 0; i < 12; i++) for await (const _ of $.turn.step({ turnId: 't1', index: i, model: 'm', messageCount: 2, agentId: 'a1' })) { /* drain */ }
  await w.clock.advance(5)
  for (let i = 0; i < 4; i++) { await w.clock.settle(); await flush(200) }
}

test('W12 + W14: sentinel calls carry the system line, learn text is wrapped, a second Learn waits for the first', async ($, on) => {
  const w = sentinelWorld(on)
  await $.command.run(RUN())
  await review($, w)
  expect(w.completes).toHaveLength(1)
  expect(w.completes[0].system).toBe(SENTINEL_SYSTEM)
  const ui = await $.ui.mount(ABOVE)
  let release: () => void = () => undefined
  w.gate.p = new Promise<void>(r => { release = r })
  await ui.press({ key: 'sentinel-learn' })
  await ui.press({ key: 'sentinel-learn' })
  await flush(100)
  expect(w.completes).toHaveLength(2)
  expect(w.completes[1].system).toBe(SENTINEL_SYSTEM)
  expect(w.completes[1].prompt).toContain('<untrusted kind="card">\nNo test covers the new export\n</untrusted>')
  release()
  await flush(100)
  await ui.unmount()
})

test('W9: a model card is retired when the current slice moves on', async ($, on) => {
  const w = sentinelWorld(on)
  await $.command.run(RUN())
  await review($, w)
  const ui = await $.ui.mount(ABOVE)
  expect(await ui.find({ type: 'Text', text: /No test covers the new export/ })).toBeDefined()
  w.slices = '1\tcommitted\ta\tabc\n2\tcommitted\tb\tdef\n3\tgreen\tc\t-\n'
  await $.command.run(RUN())
  await $.turn.complete(DONE)
  await flush(100)
  expect(await ui.findAll({ type: 'Text', text: /No test covers the new export/ })).toEqual([])
  await ui.unmount()
})
