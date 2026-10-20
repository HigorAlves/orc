import { expect, test } from 'claude-code/testing'
import { parseFeatures, DEFAULTS } from '../config'
test('defaults fill every switch', () => { expect(parseFeatures({})).toEqual(DEFAULTS) })
test('bad enum values fall back', () => {
  expect(parseFeatures({ cache_cliff: 'bogus', sentinel: 'loud' })).toMatchObject({ cacheCliff: 'warn', sentinel: 'model' })
})
test('sentinel_every clamps to 4', () => { expect(parseFeatures({ sentinel_every: 1 }).sentinelEvery).toBe(4) })
test('booleans pass through', () => { expect(parseFeatures({ progress_band: false, corrections: false })).toMatchObject({ progressBand: false, corrections: false }) })
