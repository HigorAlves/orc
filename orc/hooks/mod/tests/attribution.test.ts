import { expect, mock, test } from 'claude-code/testing'

// What Claude Code composed before the mod runs: the trailer the model would be told to add.
const COMPOSED = 'Co-Authored-By: <assistant>'

test('commit attribution text is blanked', async ($, on) => {
  mock.env(on, {})
  on('attribution.text', () => ({ text: COMPOSED }))
  const out = await $.attribution.text({ kind: 'commit', text: COMPOSED })
  expect(out.text).toBe('')
})

test('PR attribution text is blanked', async ($, on) => {
  mock.env(on, {})
  on('attribution.text', () => ({ text: COMPOSED }))
  const out = await $.attribution.text({ kind: 'pr', text: COMPOSED })
  expect(out.text).toBe('')
})

test('the engine gate sentences pass through untouched', async ($, on) => {
  mock.env(on, {})
  on('attribution.text', ($, e) => ({ text: e.text }))
  const out = await $.attribution.text({ kind: 'exemption', text: 'exempt: user opted out' })
  expect(out.text).toBe('exempt: user opted out')
})

test('ORC_ALLOW_AI_ATTRIBUTION=1 keeps the composed text', async ($, on) => {
  mock.env(on, { ORC_ALLOW_AI_ATTRIBUTION: '1' })
  on('attribution.text', ($, e) => ({ text: e.text }))
  const out = await $.attribution.text({ kind: 'commit', text: COMPOSED })
  expect(out.text).toBe(COMPOSED)
})
