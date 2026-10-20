import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { ran } from './helpers'

const session = (phase: number) => JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase, phaseLabel: 'implement', totalPhases: 9 })
const SLICES = '1\tcommitted\ta\tabc\n2\tgreen\tb\t-\n3\tpending\tc\t-\n'
const RUN = (args = '') => ({ command: 'orc', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } })
const writes: { key?: string; value: any }[] = []
const opens: unknown[] = []
const closes: unknown[] = []
const order: string[] = []
const fills: unknown[] = []

function world(on: On, opts: { phase?: number; old?: string | null; fail?: boolean } = {}) {
  writes.length = 0; opens.length = 0; closes.length = 0; order.length = 0; fills.length = 0
  on('process.run', ($, e) => {
    if (e.argv[0] === 'git') {
      if (e.argv.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      return ran('')
    }
    if (e.argv[1] === 'get') return ran(session(opts.phase ?? 5))
    if (e.argv[1] === 'slice') return ran(SLICES)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('clock.now', () => ({ value: 120_000 }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('fs.read', () => {
    order.push('read')
    if (opts.old === null) throw new Error('ENOENT')
    return { value: opts.old ?? 'one\ntwo\n' }
  })
  on('ui.open', ($, e) => { opens.push(e); return { value: { isPlaced: true } } })
  on('ui.close', ($, e) => { closes.push(e); return { value: undefined } as never })
  on('ui.focus', () => ({ value: undefined }) as never)
  on('prompt.fill', ($, e) => { fills.push(e); return { value: { isFilled: true } } })
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('tool.call', () => { order.push('tool'); return (opts.fail ? { isError: true as const, result: 'nope' } : { result: { type: 'text', file: {} } }) as never })
}
const replay = () => writes.filter(w => w.key === 'replay').at(-1)?.value
const PANE = (surface: 'terminal' | 'desktop') => ({
  plugin: 'orc', surface, component: 'Pane' as const, requestId: 'orc-replay', viewport: { columns: 120, rows: 40 },
  props: { title: 'replay', isFocused: true, bodyColumns: 60, placement: 'inline' as const, scroll: { offset: 0, bodyRows: 16 }, view: {} },
})
const ABOVE = (surface: 'terminal' | 'desktop') => ({
  plugin: 'orc', surface, component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: {} as never, view: {} as never },
})
const edit = ($: any, path = '/w/src/a.ts', o = 'x', n = 'y') => $.tool.call({ tool: 'Edit', tool_use_id: 'e' + Math.random(), file_path: path, old_string: o, new_string: n })

test('an Edit is recorded under the current slice, relative to the repo root', async ($, on) => {
  world(on)
  await $.command.run(RUN())
  await edit($)
  const r = replay()
  expect(r.edits.length).toBe(1)
  expect(r.edits[0]).toMatchObject({ sliceId: 2, path: 'src/a.ts', tool: 'Edit', add: 1, del: 1 })
})

test('a Write reads the old file BEFORE the write runs; a missing file diffs from empty', async ($, on) => {
  world(on, { old: 'one\ntwo\n' })
  await $.command.run(RUN())
  order.length = 0
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: '/w/src/c.ts', content: 'one\nthree\n' })
  expect(order.slice(0, 2)).toEqual(['read', 'tool'])
  expect(replay().edits[0]).toMatchObject({ tool: 'Write', add: 1, del: 1 })
})

test('a Write to a missing file is all additions', async ($, on) => {
  world(on, { old: null })
  await $.command.run(RUN())
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: '/w/src/new.ts', content: 'a\nb\n' })
  expect(replay().edits[0]).toMatchObject({ add: 2, del: 0 })
})

test('a MultiEdit concatenates its edits', async ($, on) => {
  world(on)
  await $.command.run(RUN())
  await $.tool.call({ tool: 'MultiEdit', tool_use_id: 'm1', file_path: '/w/src/a.ts', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: 'd' }] } as never)
  expect(replay().edits[0]).toMatchObject({ tool: 'MultiEdit', add: 2, del: 2 })
})

test('an errored call records nothing', async ($, on) => {
  world(on, { fail: true })
  await $.command.run(RUN())
  await edit($)
  expect(replay()).toBeUndefined()
})

test('replay: false records nothing and reads no file', { options: { replay: false, sentinel: 'off' } }, async ($, on) => {
  world(on)
  await $.command.run(RUN())
  order.length = 0
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: '/w/src/c.ts', content: 'x' })
  expect(order).toEqual(['tool'])
  expect(replay()).toBeUndefined()
})

test('/orc replay with nothing recorded answers in text and opens no pane', async ($, on) => {
  world(on)
  const r = await $.command.run(RUN('replay'))
  expect(opens).toEqual([])
  expect(JSON.stringify(r)).toContain('No edits')
})

test('/orc replay opens orc-replay at the latest slice', async ($, on) => {
  world(on)
  await $.command.run(RUN())
  await edit($)
  opens.length = 0
  await $.command.run(RUN('replay'))
  expect(opens).toMatchObject([{ id: 'orc-replay', rows: 18, columns: 64 }])
  expect(replay().view).toEqual({ slice: 0, step: 0 })
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the replay pane draws the diff on ${surface}; Next steps, Prev goes back, Close closes and resets`, async ($, on) => {
    world(on)
    await $.command.run(RUN())
    await edit($, '/w/src/a.ts', 'x', 'y')
    await edit($, '/w/src/b.ts', 'p', 'q')
    await $.command.run(RUN('replay'))
    const ui = await $.ui.mount(PANE(surface))
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Code' })).toMatchObject({ props: { format: 'diff' } })
      expect(await ui.find({ type: 'Text', text: /Slice 2 .*Edit src\/a\.ts/ })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Svg', alt: /slice 2, step 1 of 2, Edit src\/a\.ts/ })).toBeDefined()
    }
    expect(await ui.find({ key: 'replay-prev' })).toMatchObject({ props: { hotkey: 'p' } })
    expect(await ui.find({ key: 'replay-next' })).toMatchObject({ props: { hotkey: 'n' } })
    expect(await ui.find({ key: 'replay-close' })).toMatchObject({ props: { hotkey: 'c', role: 'dismiss' } })
    await ui.press({ key: 'replay-next' })
    expect(replay().view).toEqual({ slice: 0, step: 1 })
    await ui.press({ key: 'replay-prev' })
    expect(replay().view).toEqual({ slice: 0, step: 0 })
    await ui.press({ key: 'replay-close' })
    expect(closes).toMatchObject([{ id: 'orc-replay' }])
    await ui.unmount()
  })
}

test('closing the pane resets the view index', async ($, on) => {
  world(on)
  await $.command.run(RUN())
  await edit($)
  await edit($, '/w/src/b.ts')
  await $.command.run(RUN('replay'))
  const ui = await $.ui.mount(PANE('terminal'))
  await ui.press({ key: 'replay-next' })
  expect(replay().view.step).toBe(1)
  await ui.press({ key: 'replay-close' })
  expect(replay().view).toEqual({ slice: 0, step: 0 })
  await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the progress band gains a Replay button from phase 6 once an edit is recorded (${surface})`, async ($, on) => {
    world(on, { phase: 6 })
    await $.command.run(RUN())
    const ui0 = await $.ui.mount(ABOVE(surface))
    expect(await ui0.findAll({ key: 'orc-replay' })).toEqual([])
    await ui0.unmount()
    await edit($)
    const ui = await $.ui.mount(ABOVE(surface))
    expect(await ui.find({ key: 'orc-replay' })).toMatchObject({ props: { hotkey: 'r' } })
    opens.length = 0
    await ui.press({ key: 'orc-replay' })
    expect(opens).toMatchObject([{ id: 'orc-replay' }])
    await ui.unmount()
  })
}

test('no Replay button before phase 6', async ($, on) => {
  world(on, { phase: 5 })
  await $.command.run(RUN())
  await edit($)
  const ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.findAll({ key: 'orc-replay' })).toEqual([])
  await ui.unmount()
})

test('M22 a hunk whose body lines start with --- / +++ still mounts as a diff Code block', async ($, on) => {
  world(on)
  await $.command.run(RUN())
  await edit($, '/w/src/a.sql', '-- old comment', '++ new marker')
  await $.command.run(RUN('replay'))
  const ui = await $.ui.mount(PANE('terminal'))
  expect(await ui.find({ type: 'Code' })).toMatchObject({ props: { format: 'diff' } })
})
