import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { ran, flush } from './helpers'

const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9 })
const SLICES = '1\tcommitted\ta\tabc\n4\tgreen\tb\t-\n'
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const ABOVE = (surface: 'terminal' | 'desktop') => ({
  plugin: 'orc', surface, component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: {} as never, view: {} as never },
})
const bash = (command: string) => ({ tool: 'Bash' as const, tool_use_id: 'toolu_g1', command })
const BENEATH = { result: { stdout: 'floor', stderr: '', interrupted: false } }

const notices: { tool_use_id: string; text: string }[] = []
const measured: string[][] = []
let gate: Promise<void> = Promise.resolve()
let release: () => void = () => undefined

function world(on: On, opts: { session?: boolean; fail?: boolean; deny?: boolean } = {}) {
  notices.length = 0
  measured.length = 0
  gate = new Promise<void>(r => { release = r })
  on('process.run', ($, e) => {
    const argv = e.argv
    if (argv[0] === 'git') {
      if (argv.includes('--show-toplevel')) return ran('/w\n/w/.git\n')
      if (argv.includes('--abbrev-ref') && argv.includes('origin/HEAD')) return ran('origin/main\n')
      if (argv.includes('merge-base')) return ran('deadbeef\n')
      measured.push([...argv])
      if (opts.fail) return ran('', 128)
      if (argv.includes('--porcelain')) return ran(' M a.ts\n M b.ts\n')
      if (argv.includes('--shortstat')) return ran(' 2 files changed, 5 insertions(+), 1 deletion(-)\n')
      return ran('')
    }
    if (opts.session === false) return ran('', 1)
    if (argv[1] === 'get') return ran(SESSION)
    if (argv[1] === 'slice') return ran(SLICES)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 120_000 }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('ui.notice', ($, e) => { notices.push(e as never); return { value: undefined } as never })
  on('tool.call', async () => {
    await gate
    return (opts.deny ? { deny: 'floor says no' } : BENEATH) as never
  })
}

test('a guarded command is measured, then notices post while the floor is pending; the band shows the guard row only then', async ($, on) => {
  world(on)
  const ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.drawn()).toEqual({ type: 'engine', ref: 0 })
  const pending = $.tool.call(bash('git reset --hard'))
  await flush(200)
  expect(measured.map(a => a.slice(1).join(' '))).toEqual(['status --porcelain --untracked-files=no', 'diff --shortstat HEAD'])
  expect(notices.map(n => n.text)[0]).toBe('Would discard uncommitted changes in 2 files')
  expect(notices.every(n => n.tool_use_id === 'toolu_g1')).toBe(true)
  expect(await ui.find({ type: 'Text', text: /Would discard uncommitted changes in 2 files/ })).toBeDefined()
  release()
  expect(await pending).toEqual(BENEATH)
  await flush(50)
  expect(await ui.drawn()).toEqual({ type: 'engine', ref: 0 })
  await ui.unmount()
})

test('the guard row is an Svg card on desktop', async ($, on) => {
  world(on)
  const ui = await $.ui.mount(ABOVE('desktop'))
  const pending = $.tool.call(bash('git clean -fd'))
  await flush(200)
  expect(await ui.find({ type: 'Svg', alt: /Would delete|No untracked/ })).toBeDefined()
  release()
  await pending
  await ui.unmount()
})

test('git -C <path> scopes the measure argv', async ($, on) => {
  world(on)
  release()
  await $.tool.call(bash('git -C ../x reset --hard'))
  expect(measured[0].slice(0, 3)).toEqual(['git', '-C', '../x'])
})

test('edits not yet checkpointed add a notice', async ($, on) => {
  world(on)
  release()
  await $.command.run(RUN)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: '/w/src/b.ts', old_string: 'x', new_string: 'y' })
  await $.tool.call(bash('git reset --hard'))
  expect(notices.map(n => n.text)).toContain('slice 4 has edits not yet checkpointed')
})

test('unclassified command: no measure, no notice, result untouched', async ($, on) => {
  world(on)
  release()
  expect(await $.tool.call(bash('git status'))).toEqual(BENEATH)
  expect(measured).toEqual([])
  expect(notices).toEqual([])
})

test('a measure failure leaves behaviour as today', async ($, on) => {
  world(on, { fail: true })
  release()
  expect(await $.tool.call(bash('git reset --hard'))).toEqual(BENEATH)
  expect(notices).toEqual([])
})

test('guard_measure: false skips measuring', { options: { guard_measure: false } }, async ($, on) => {
  world(on)
  release()
  expect(await $.tool.call(bash('git reset --hard'))).toEqual(BENEATH)
  expect(measured).toEqual([])
  expect(notices).toEqual([])
})

test('the hook never denies, even when the floor does', async ($, on) => {
  world(on, { deny: true })
  release()
  expect(await $.tool.call(bash('git push --force origin main'))).toEqual({ deny: 'floor says no' })
})
