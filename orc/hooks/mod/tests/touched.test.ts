import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { MAX_FILES, TOUCHED_INITIAL, ageOf, applyNumstat, markCommitted, parseNumstat, relPath, touch, touchedRows } from '../touched/model'
import { touchedLine } from '../touched/text'
import { touchedAlt, touchedSvg } from '../touched/svg'
import { fitSvg } from '../draw/svg'
import { ran } from './helpers'

test('touch keeps the highest kind: committed > edit > read', () => {
  let t = touch(TOUCHED_INITIAL, { sliceId: '4', path: 'a.ts', kind: 'edit', at: 1 })
  t = touch(t, { sliceId: '4', path: 'a.ts', kind: 'read', at: 2 })
  expect(t.files).toEqual([{ path: 'a.ts', kind: 'edit', at: 2, add: null, del: null }])
  t = markCommitted(t, 3)
  expect(t.files[0]).toMatchObject({ kind: 'committed', at: 3 })
  t = touch(t, { sliceId: '4', path: 'a.ts', kind: 'edit', at: 4 })
  expect(t.files[0].kind).toBe('committed')
})

test('markCommitted leaves reads alone', () => {
  let t = touch(TOUCHED_INITIAL, { sliceId: '4', path: 'r.ts', kind: 'read', at: 1 })
  t = touch(t, { sliceId: '4', path: 'e.ts', kind: 'edit', at: 2 })
  expect(markCommitted(t, 9).files.map(f => f.kind)).toEqual(['read', 'committed'])
})

test('a new slice starts a fresh list', () => {
  let t = touch(TOUCHED_INITIAL, { sliceId: '4', path: 'a.ts', kind: 'edit', at: 1 })
  t = touch(t, { sliceId: '5', path: 'b.ts', kind: 'read', at: 2 })
  expect(t.sliceId).toBe('5')
  expect(t.files.map(f => f.path)).toEqual(['b.ts'])
})

test('the list is capped at 40, dropping the oldest', () => {
  let t = TOUCHED_INITIAL
  for (let i = 0; i < 45; i++) t = touch(t, { sliceId: '1', path: `f${i}.ts`, kind: 'read', at: i })
  expect(t.files.length).toBe(MAX_FILES)
  expect(t.files[0].path).toBe('f5.ts')
  expect(t.files.at(-1)?.path).toBe('f44.ts')
})

test('numstat parses counts, skips binaries, and applies by path', () => {
  const counts = parseNumstat('42\t3\tsrc/a.ts\n-\t-\timg.png\n1\t0\tb.ts\n')
  expect(counts.get('src/a.ts')).toEqual({ add: 42, del: 3 })
  expect(counts.has('img.png')).toBe(false)
  let t = touch(TOUCHED_INITIAL, { sliceId: '1', path: 'src/a.ts', kind: 'edit', at: 1 })
  t = touch(t, { sliceId: '1', path: 'other.ts', kind: 'read', at: 1 })
  const applied = applyNumstat(t, counts, 'S')
  expect(applied.stamp).toBe('S')
  expect(applied.files.map(f => [f.add, f.del])).toEqual([[42, 3], [null, null]])
})

test('relPath, ageOf and the row line', () => {
  expect(relPath('/w/src/a.ts', '/w')).toBe('src/a.ts')
  expect(relPath('/elsewhere/a.ts', '/w')).toBe('/elsewhere/a.ts')
  expect([ageOf(5_000), ageOf(120_000), ageOf(7_200_000)]).toEqual(['5s', '2m', '2h'])
  let t = touch(TOUCHED_INITIAL, { sliceId: '1', path: 'src/a.ts', kind: 'edit', at: 0 })
  t = applyNumstat(t, new Map([['src/a.ts', { add: 42, del: 3 }]]), 's')
  expect(touchedLine(touchedRows(t, 120_000)[0])).toBe('● src/a.ts +42 −3 edit 2m')
})

test('touchedSvg fits and its alt counts by kind', () => {
  let t = touch(TOUCHED_INITIAL, { sliceId: '1', path: 'a.ts', kind: 'edit', at: 0 })
  t = touch(t, { sliceId: '1', path: 'b.ts', kind: 'read', at: 0 })
  const rows = touchedRows(t, 1000)
  expect(fitSvg(touchedSvg(rows, 640))).not.toBeNull()
  expect(touchedAlt(rows)).toBe('2 files touched in this slice: 0 committed, 1 edited, 1 read')
})

// --- engine ---
const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 })
const SLICES = '1\tcommitted\ta\tabc\n2\tgreen\tb\t-\n3\tpending\tc\t-\n'
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const writes: { key?: string; value: any }[] = []
const gitCalls: string[][] = []
let stampNow = 100

function world(on: On, opts: { slices?: string } = {}) {
  writes.length = 0
  gitCalls.length = 0
  on('process.run', ($, e) => {
    if (e.argv[0] === 'git') {
      gitCalls.push([...e.argv])
      const sub = e.argv.filter(a => !a.startsWith('/'))[1] ?? e.argv[1]
      if (e.argv.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      if (e.argv.includes('--abbrev-ref')) return ran('origin/main\n')
      if (e.argv.includes('merge-base')) return ran('deadbeef\n')
      if (e.argv.includes('--numstat')) return ran('42\t3\tsrc/a.ts\n')
      return ran(sub ? '' : '')
    }
    if (e.argv[1] === 'get') return ran(SESSION)
    if (e.argv[1] === 'slice') return ran(opts.slices ?? SLICES)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 120_000 }))
  on('fs.stat', () => ({ value: { mtimeMs: stampNow, size: 0, kind: 'file' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
}
const lastTouched = () => writes.filter(w => w.key === 'touched').at(-1)?.value
const ok = { result: { type: 'text', file: {} } }
const beneathTools = (on: On, deny = false) =>
  on('tool.call', () => (deny ? { isError: true as const, result: 'nope' } : (ok as never)))

test('Read marks read, Edit and Write mark edit, relative to the repo root, keyed to the current slice', async ($, on) => {
  world(on)
  beneathTools(on)
  await $.command.run(RUN)
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/w/src/a.ts' })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/w/src/b.ts', old_string: 'x', new_string: 'y' })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: '/w/src/c.ts', content: 'z' })
  const t = lastTouched()
  expect(t.sliceId).toBe('2')
  expect(t.files.map((f: any) => [f.path, f.kind])).toEqual([['src/a.ts', 'read'], ['src/b.ts', 'edit'], ['src/c.ts', 'edit']])
})

test('an errored call marks nothing', async ($, on) => {
  world(on)
  beneathTools(on, true)
  await $.command.run(RUN)
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/w/src/a.ts' })
  expect(lastTouched()).toBeUndefined()
})

test('without an orc session nothing is recorded', async ($, on) => {
  world(on)
  beneathTools(on)
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/w/src/a.ts' })
  expect(lastTouched()).toBeUndefined()
})

test('a git commit through Bash commits the slice edits', async ($, on) => {
  world(on)
  on('tool.call', ($, e) => (e.tool === 'Bash' ? { result: { stdout: '', stderr: '', interrupted: false } } : (ok as never)) as never)
  await $.command.run(RUN)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/w/src/b.ts', old_string: 'x', new_string: 'y' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/w/src/a.ts' })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'git add -A && git commit -m "feat: x"' })
  expect(lastTouched().files.map((f: any) => [f.path, f.kind])).toEqual([['src/b.ts', 'committed'], ['src/a.ts', 'read']])
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b2', command: 'git status' })
  expect(lastTouched().files[0].kind).toBe('committed')
})

const PANE = {
  plugin: 'orc', component: 'Pane', requestId: 'orc-cockpit', viewport: { columns: 120, rows: 40 },
  props: { title: 'orc', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the cockpit Touched section draws on ${surface}; counts refresh only when the git stamp moves`, async ($, on) => {
    world(on)
    beneathTools(on)
    await $.command.run(RUN)
    await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/w/src/a.ts', old_string: 'x', new_string: 'y' })
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'sec-touched' })
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /● src\/a\.ts \+42 −3 edit/ })).toBeDefined()
    else expect(await ui.find({ type: 'Svg', alt: /1 files touched in this slice: 0 committed, 1 edited, 0 read/ })).toBeDefined()
    const numstats = () => gitCalls.filter(c => c.includes('--numstat')).length
    expect(numstats()).toBe(1)
    await ui.press({ key: 'sec-touched' })
    await ui.press({ key: 'sec-touched' })
    expect(numstats()).toBe(1)
    stampNow = 200
    await ui.press({ key: 'sec-touched' })
    await ui.press({ key: 'sec-touched' })
    expect(numstats()).toBe(2)
    stampNow = 100
    await ui.unmount()
  })
}
