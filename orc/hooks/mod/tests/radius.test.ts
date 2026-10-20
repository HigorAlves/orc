import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { countDependents, parseAffected, parseNames } from '../radius/model'
import { radiusLine } from '../radius/text'
import { radiusAlt, radiusSvg } from '../radius/svg'
import { fitSvg } from '../draw/svg'
import { ran } from './helpers'

const AFFECTED = `Affected nodes for pane.ts
Relations: calls, imports
Depth: 1
- register.ts [imports_from] orc/hooks/mod/register.ts:L11
- register_cockpit() [calls] orc/hooks/mod/register.ts:L264
- drawPane() [calls] orc/hooks/mod/other.ts:L9
`

test('parseAffected reads node lines and the match header', () => {
  const a = parseAffected(AFFECTED)
  expect(a.matched).toBe(true)
  expect(a.nodes).toEqual([
    { name: 'register.ts', file: 'orc/hooks/mod/register.ts' },
    { name: 'register_cockpit()', file: 'orc/hooks/mod/register.ts' },
    { name: 'drawPane()', file: 'orc/hooks/mod/other.ts' },
  ])
  expect(parseAffected('No unique node match for zzz\n')).toEqual({ matched: false, nodes: [] })
})

test('countDependents is distinct, skips changed files, and is null when the graph matched nothing', () => {
  const a = parseAffected(AFFECTED)
  expect(countDependents([a, a], [])).toBe(3)
  expect(countDependents([a], ['orc/hooks/mod/register.ts'])).toBe(1)
  expect(countDependents([parseAffected('No unique node match for x\n')], [])).toBeNull()
})

test('parseNames splits non-empty lines', () => expect(parseNames('a.ts\n\n b.ts \n')).toEqual(['a.ts', 'b.ts']))

test('radiusLine: over budget, under budget, and without dependents', () => {
  expect(radiusLine({ loc: 412, budget: 300, files: 9, dependents: 23 })).toBe('LOC 412/300 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ over by 112 · 9 files · 23 dependents')
  expect(radiusLine({ loc: 150, budget: 300, files: 1, dependents: null })).toBe('LOC 150/300 ▓▓▓▓▓▓▓░░░░░░░│ 150 under · 1 file')
})

test('radiusSvg fits and carries the same words as its alt', () => {
  const m = { loc: 412, budget: 300, files: 9, dependents: 23 }
  const svg = radiusSvg(m, 80)
  expect(svg).not.toBeNull()
  expect(fitSvg(svg as string)).not.toBeNull()
  expect(radiusAlt(m)).toBe(radiusLine(m))
})

// --- engine ---
const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 7, phaseLabel: 'ship', totalPhases: 9 })
const RUN = (args = '') => ({ command: 'orc', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } })
const PANE = {
  plugin: 'orc', component: 'Pane', requestId: 'orc-cockpit', viewport: { columns: 120, rows: 40 },
  props: { title: 'orc', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const calls: string[][] = []
const writes: { key?: string; value: any }[] = []
function world(on: On, opts: { graphify?: 'ok' | 'missing' | 'fail' } = {}) {
  calls.length = 0
  writes.length = 0
  on('process.run', ($, e) => {
    const a = e.argv
    calls.push([...a])
    if (a[0] === 'graphify') {
      if (opts.graphify === 'missing') throw new Error('ENOENT')
      return opts.graphify === 'fail' ? ran('', 1) : ran(AFFECTED)
    }
    if (a[0] === 'git') {
      if (a.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      if (a.includes('--abbrev-ref')) return ran('origin/main\n')
      if (a.includes('merge-base')) return ran('deadbeef\n')
      if (a.includes('--name-only')) return ran('src/a.ts\nsrc/b.ts\n')
      return ran('')
    }
    if (a[0].endsWith('orc-pr-size')) return ran(a[1] === 'loc' ? '412\n' : '300\n')
    if (a[1] === 'get') return ran(SESSION)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1000 }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('state.set', ($, e, next) => { writes.push(e as never); return next(e) })
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the Radius section loads on open and draws on ${surface}`, async ($, on) => {
    world(on)
    await $.command.run(RUN())
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(calls.some(c => c[0] === 'graphify')).toBe(false)
    await ui.press({ key: 'sec-radius' })
    const words = 'LOC 412/300 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ over by 112 · 2 files · 3 dependents'
    if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: words })).toBeDefined()
    else expect(await ui.find({ type: 'Svg', alt: words })).toBeDefined()
    expect(calls.filter(c => c[0] === 'graphify').map(c => c.slice(1))).toEqual([['affected', 'src/a.ts', '--depth', '1'], ['affected', 'src/b.ts', '--depth', '1']])
    expect(calls.find(c => c.includes('--name-only'))).toContain('deadbeef...HEAD')
    await ui.unmount()
  })
}

for (const graphify of ['missing', 'fail'] as const) {
  test(`graphify ${graphify}: dependents are left out without an error`, async ($, on) => {
    world(on, { graphify })
    await $.command.run(RUN())
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'sec-radius' })
    expect(await ui.find({ type: 'Text', text: 'LOC 412/300 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ over by 112 · 2 files' })).toBeDefined()
    await ui.unmount()
  })
}

test('/orc radius opens the cockpit with the section expanded and loaded', async ($, on) => {
  world(on)
  await $.command.run(RUN('radius'))
  const sections = writes.filter(w => w.key === 'sections').at(-1)?.value
  expect(sections.radius).toBe(true)
  expect(writes.filter(w => w.key === 'radius').at(-1)?.value).toEqual({ loc: 412, budget: 300, files: 2, dependents: 3 })
})
