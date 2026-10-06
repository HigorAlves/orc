import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { spawnOf } from './helpers'

function recordSpawns(on: On, seen: (string | undefined)[]) {
  on('agent.spawn', ($, e) => { seen.push(e.model); return { model: e.model ?? 'frontmatter', agentId: 'a' + seen.length } })
}

test('balanced (the default) leaves every agent on its frontmatter model', async ($, on) => {
  const seen: (string | undefined)[] = []
  recordSpawns(on, seen)
  await $.agent.spawn(spawnOf('orc:orc-debug-investigator'))
  expect(seen).toEqual([undefined])
})

test('quality steps the investigator up to best (Fable, else Opus)', { options: { model_profile: 'quality' } }, async ($, on) => {
  const seen: (string | undefined)[] = []
  recordSpawns(on, seen)
  await $.agent.spawn(spawnOf('orc:orc-debug-investigator'))
  await $.agent.spawn(spawnOf('orc-code-fixer'))
  await $.agent.spawn(spawnOf('orc:orc-implementer'))
  expect(seen).toEqual(['best', 'sonnet', undefined])
})

test('an explicit per-call model (an escalation step-up) always wins', { options: { model_profile: 'economy' } }, async ($, on) => {
  const seen: (string | undefined)[] = []
  recordSpawns(on, seen)
  await $.agent.spawn(spawnOf('orc:orc-debug-investigator', 'fable'))
  await $.agent.spawn(spawnOf('orc:orc-debug-investigator'))
  expect(seen).toEqual(['fable', 'sonnet'])
})

test('non-orc agents are never touched', { options: { model_profile: 'quality' } }, async ($, on) => {
  const seen: (string | undefined)[] = []
  recordSpawns(on, seen)
  await $.agent.spawn(spawnOf('Explore'))
  expect(seen).toEqual([undefined])
})
