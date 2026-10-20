import { expect, test } from 'claude-code/testing'
import { PRIORITY, pickBand, type BandRow } from '../band'
import { ciBox } from '../state'

const ci: BandRow = { kind: 'ci', pr: 12, failing: ['lint'] }
const guard: BandRow = { kind: 'guard', summary: 'Would discard 7 files' }
const sentinel: BandRow = { kind: 'sentinel', id: 's1', text: 'outside slice' }
const retro: BandRow = { kind: 'retro', id: 'r1', rule: 'use pnpm', seen: 2 }
const cache: BandRow = { kind: 'cache', minutesLeft: 4, rewriteUsd: 0.4, tokens: 90000, waitingOn: null }
const progress: BandRow = { kind: 'progress', model: {} as never }

test('pickBand returns the highest-priority present row', () => {
  const all = [progress, cache, retro, sentinel, guard, ci]
  expect(PRIORITY).toEqual(['guard', 'ci', 'sentinel', 'retro', 'cache', 'progress'])
  const order: BandRow['kind'][] = []
  let rest = all
  while (rest.length) {
    const row = pickBand(rest) as BandRow
    order.push(row.kind)
    rest = rest.filter(r => r.kind !== row.kind)
  }
  expect(order).toEqual(['guard', 'ci', 'sentinel', 'retro', 'cache', 'progress'])
})

test('pickBand ignores empty slots and returns null when nothing is present', () => {
  expect(pickBand([null, undefined, cache, null])?.kind).toBe('cache')
  expect(pickBand([null, undefined])).toBeNull()
  expect(pickBand([])).toBeNull()
})

const ABOVE = (surface: 'terminal' | 'desktop', hasSurvey = false) => ({
  plugin: 'orc', surface, component: 'AbovePrompt' as const,
  props: { hasSurvey, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: {} as never, view: {} as never },
})

test('with no orc row the band returns the engine drawing untouched', async ($, on) => {
  ciBox.alert = null
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  const ui = await $.ui.mount(ABOVE('terminal'))
  expect(await ui.drawn()).toEqual({ type: 'engine', ref: 0 })
  await ui.unmount()
})

test('a survey takes the band: orc yields even with a red CI row', async ($, on) => {
  ciBox.alert = { pr: 12, summary: { state: 'fail', failing: ['lint'], pending: 0, total: 2 } }
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  const ui = await $.ui.mount(ABOVE('terminal', true))
  expect(await ui.drawn()).toEqual({ type: 'engine', ref: 0 })
  await ui.unmount()
  ciBox.alert = null
})
