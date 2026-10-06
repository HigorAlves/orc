import { expect, test } from 'claude-code/testing'
import { cutDiff, currentSlice, digestOf } from '../cockpit'

const CHECKPOINT = `---\ncommand: flow\n---\n# flow\n\n## Resume digest\nPhase 5 implementing slice 3.\nNext: /orc:resume\n\n## Auto-checkpoint\nold\n`

test('digestOf keeps the Resume digest section alone', async () => {
  expect(digestOf(CHECKPOINT)).toBe('Phase 5 implementing slice 3.\nNext: /orc:resume')
  expect(digestOf('# nothing here')).toBeNull()
})

test('cutDiff cuts at a file boundary and says so', async () => {
  const file = (n: number) => `diff --git a/f${n} b/f${n}\n--- a/f${n}\n+++ b/f${n}\n@@ -1 +1 @@\n-${'x'.repeat(3000)}\n+${'y'.repeat(3000)}\n`
  const big = file(1) + file(2) + file(3)
  const cut = cutDiff(big, 8000)
  expect(cut.truncated).toBe(true)
  expect(cut.source).toBe(file(1))
  expect(cutDiff('short', 8000)).toEqual({ source: 'short', truncated: false })
})

test('currentSlice is the first slice not yet done', async () => {
  const slices = [
    { id: '1', status: 'committed', title: 'a', commit: 'abc' },
    { id: '2', status: 'red', title: 'b', commit: null },
    { id: '3', status: 'pending', title: 'c', commit: null },
  ]
  expect(currentSlice(slices)?.id).toBe('2')
  expect(currentSlice([])).toBeNull()
})
