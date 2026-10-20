import { expect, test, type Plugin } from 'claude-code/testing'
import { statusInfo } from '../api'
import { companionsOf } from '../companions'
import { EMPTY, type Snapshot } from '../cockpit'
import { ran } from './helpers'

const SESSION = JSON.stringify({ command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9, linkedPRs: [{ url: 'https://github.com/a/b/pull/7', number: 7 }] })
const SLICES = ['1\tcommitted\tone\tabc', '2\tgreen\ttwo\t-', '3\tpending\tthree\t-'].join('\n')
const GUIDED = JSON.stringify({ schema: 1, decisions: { autopilotLevel: { value: 'guided', provenance: 'flag' } } })

const snap: Snapshot = {
  session: { command: 'flow', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 5, phaseLabel: 'implement', totalPhases: 9, linkedPRs: [{ number: 7 }] },
  slices: [{ id: '1', status: 'committed', title: 'a', commit: 'x' }, { id: '2', status: 'green', title: 'b', commit: null }],
  decisions: [{ key: 'autopilotLevel', value: 'guided', provenance: 'flag' }],
  qa: { verdict: 'partial', acceptance: [], missing: [] },
}

test('companionsOf recognises the known companion mods by plugin name', () => {
  expect(companionsOf(['orc', 'claude-skins', 'filetree'])).toEqual({ skins: true, filetree: true, reflect: false, youShouldKnow: false, terminalBrowser: false })
  expect(companionsOf(['orc'])).toEqual({ skins: false, filetree: false, reflect: false, youShouldKnow: false, terminalBrowser: false })
  expect(companionsOf(['reflect', 'you-should-know', 'terminal-browser']))
    .toEqual({ skins: false, filetree: false, reflect: true, youShouldKnow: true, terminalBrowser: true })
})

test('statusInfo summarises the snapshot', () => {
  expect(statusInfo(snap)).toEqual({ phase: 5, phaseLabel: 'implement', slicesDone: 1, slicesTotal: 2, qa: 'partial', pr: 7, policy: 'guided' })
})

test('statusInfo on an empty snapshot is all nulls and zeros', () => {
  expect(statusInfo(EMPTY)).toEqual({ phase: null, phaseLabel: null, slicesDone: 0, slicesTotal: 0, qa: null, pr: null, policy: null })
})

// An inline plugin that depends on orc's noun, the way a companion mod would.
// (inline plugins are self-contained: it hands the answer out through $.store)
const reader: Plugin = {
  name: 'reader',
  register: on => {
    on('session.start', async ($, e, next) => {
      await $.store.set('got', await ($ as unknown as { orc: { status: () => Promise<unknown> } }).orc.status())
      return next(e)
    })
  },
}

test('a sibling plugin reads $.orc.status() from the live snapshot', { plugins: [reader] }, async ($, on) => {
  on('process.run', ($, e) => {
    if (e.argv[1] === 'get') return ran(SESSION)
    if (e.argv[1] === 'slice') return ran(SLICES)
    if (e.argv[1] === 'decision') return ran(GUIDED)
    return ran('')
  })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('command.register', () => ({ value: { command: 'orc' } }))
  on('session.start', () => ({ cwd: '/work' }))
  let got: unknown = 'unset'
  on('store.set', ($, e) => { got = e.value; return { value: undefined } })
  on('session.surfaces', () => ({ value: [] }))
  // /orc loads the snapshot; the next session.start then reads it through the noun.
  await $.command.run({ command: 'orc', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await $.session.start({ surface: 'terminal', isInteractive: false, cwd: '/work' })
  expect(got).toMatchObject({ phase: 5, phaseLabel: 'implement', slicesTotal: 3, slicesDone: 1, pr: 7, policy: 'guided' })
})
