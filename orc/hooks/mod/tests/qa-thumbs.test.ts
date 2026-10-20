import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { EMBED_CAP, embeddable, openPlan, parseThumbs, pixelTerminal, type QaShot } from '../qa/model'
import { RASTER_COLUMNS, RASTER_ROWS, decode64, encode64, halfBlocks } from '../qa/raster'
import { qaAlt, qaSvg } from '../qa/svg'
import { fitSvg } from '../draw/svg'
import { ran } from './helpers'

const shot = (name: string, len: number): QaShot => ({ name, criterion: `criterion ${name}`, jpg: `/q/${name}.jpg`, png: null, b64: 'A'.repeat(len), rgb: null })

test('parseThumbs reads the verb output and tolerates garbage', () => {
  expect(parseThumbs('[{"name":"a","criterion":"c","jpg":"/x/a.jpg","png":"/x/a.png","rgb":null}]')).toEqual([{ name: 'a', criterion: 'c', jpg: '/x/a.jpg', png: '/x/a.png', rgb: null }])
  expect(parseThumbs('nope')).toEqual([])
  expect(parseThumbs(JSON.stringify([1, 2, 3, 4].map(n => ({ name: 'n' + n })))).length).toBe(3)
})

test('embeddable drops from 3 to 2 to 1 shots to stay under the embed cap', () => {
  const three = [shot('a', 50_000), shot('b', 50_000), shot('c', 50_000)]
  expect(embeddable(three, EMBED_CAP).map(s => s.name)).toEqual(['a', 'b'])
  expect(embeddable([shot('a', 70_000), shot('b', 70_000)], EMBED_CAP).map(s => s.name)).toEqual(['a'])
  expect(embeddable([shot('a', 10), shot('b', 10), shot('c', 10)]).length).toBe(3)
  expect(embeddable([{ ...shot('a', 1), b64: null }])).toEqual([])
})

test('pixelTerminal: ghostty, WezTerm or a kitty window', () => {
  expect(pixelTerminal('ghostty', undefined)).toBe(true)
  expect(pixelTerminal('WezTerm', undefined)).toBe(true)
  expect(pixelTerminal('xterm', '7')).toBe(true)
  expect(pixelTerminal('Apple_Terminal', undefined)).toBe(false)
})

test('openPlan: browser companion, macOS open, xdg-open, and nothing for non-http urls', () => {
  expect(openPlan('https://x.test/a', true, 'Linux')).toEqual({ command: { command: 'browser', args: 'https://x.test/a' } })
  expect(openPlan('https://x.test/a', false, 'Darwin\n')).toEqual({ argv: ['open', 'https://x.test/a'] })
  expect(openPlan('http://localhost:3000', false, 'Linux')).toEqual({ argv: ['xdg-open', 'http://localhost:3000'] })
  expect(openPlan('file:///etc/passwd', false, 'Darwin')).toBeNull()
  expect(openPlan(null, false, 'Darwin')).toBeNull()
})

test('base64 round-trips and matches a known literal', () => {
  expect(encode64([77, 97, 110])).toBe('TWFu')
  expect(encode64([77, 97])).toBe('TWE=')
  expect(decode64('TWE=')).toEqual([77, 97])
})

test('halfBlocks packs ▀ with fg = top pixel and bg = bottom pixel', () => {
  const px = new Array(RASTER_COLUMNS * RASTER_ROWS * 2 * 3).fill(0)
  px[0] = 255 // pixel (0,0) red
  px[RASTER_COLUMNS * 3 + 2] = 128 // pixel (0,1): blue 0x80
  const cells = halfBlocks(encode64(px))
  expect(cells).not.toBeNull()
  const bytes = decode64(cells as string)
  expect(bytes.length).toBe(RASTER_COLUMNS * RASTER_ROWS * 12)
  expect(bytes.slice(0, 12)).toEqual([0x80, 0x25, 0, 0, 0, 0, 255, 0, 128, 0, 0, 0])
  expect(halfBlocks(encode64([1, 2, 3]))).toBeNull()
})

test('qaSvg embeds jpeg data uris with criterion labels and fits', () => {
  const shots = [shot('a', 100), shot('b', 100)]
  const svg = qaSvg(shots, 640)
  expect((svg.match(/<image /g) ?? []).length).toBe(2)
  expect(svg).toContain('href="data:image/jpeg;base64,')
  expect(svg).toContain('criterion a')
  expect(fitSvg(svg)).not.toBeNull()
  expect(qaAlt(shots)).toBe('2 QA screenshots: criterion a; criterion b')
})

// --- engine ---
const SESSION = JSON.stringify({ command: 'qa', branch: 'feat-export', gitBranch: 'feat/export', status: 'in_progress', phase: 6, phaseLabel: 'qa', totalPhases: 9 })
const REPORT = JSON.stringify({ verdict: 'pass', acceptance: [{ criterion: 'Export returns 202', result: 'pass', note: '', sliceId: 1 }], missing: [], target: { name: 'staging', baseUrl: 'https://staging.example.com' } })
const THUMBS = JSON.stringify([{ name: 'ac-1', criterion: 'Export returns 202', jpg: '/q/thumbs/ac-1.jpg', png: '/q/thumbs/ac-1.png', rgb: '/q/thumbs/ac-1.rgb' }])
const RUN = { command: 'orc', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 120 } }
const PANE = {
  plugin: 'orc', component: 'Pane', requestId: 'orc-cockpit', viewport: { columns: 120, rows: 40 },
  props: { title: 'orc', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const
const RGB = encode64(new Array(RASTER_COLUMNS * RASTER_ROWS * 2 * 3).fill(7))

const calls: string[][] = []
function world(on: On, env: Record<string, string> = {}, thumbs = THUMBS) {
  calls.length = 0
  mock.env(on, env)
  on('process.run', ($, e) => {
    const a = e.argv
    calls.push([...a])
    if (a[0].endsWith('orc-report')) return ran(a[1] === 'thumbs' ? thumbs : REPORT)
    if (a[0] === 'uname') return ran('Darwin\n')
    if (a[1] === 'get') return ran(SESSION)
    return ran('')
  })
  on('fs.read', (_$, e) => ({ value: String(e.path).endsWith('.rgb') ? { base64: RGB } : { base64: 'QUJD' } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.surfaces', () => ({ value: [] }))
  on('clock.now', () => ({ value: 1000 }))
  on('fs.stat', () => ({ value: { mtimeMs: 1, size: 0, kind: 'file' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('ui.toast', () => ({ value: undefined }) as never)
}

test('terminal on ghostty draws an Image from the png thumbnail', async ($, on) => {
  world(on, { TERM_PROGRAM: 'ghostty' })
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sec-qa' })
  expect(calls.some(c => c[0].endsWith('orc-report') && c[1] === 'thumbs')).toBe(true)
  expect(await ui.find({ type: 'Image' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Export returns 202' })).toBeDefined()
  await ui.unmount()
})

test('terminal elsewhere draws a half-block Raster from the rgb', async ($, on) => {
  world(on, { TERM_PROGRAM: 'Apple_Terminal' })
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sec-qa' })
  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  await ui.unmount()
})

test('terminal without rgb or pixels falls back to the path', async ($, on) => {
  world(on, {}, JSON.stringify([{ name: 'ac-1', criterion: 'Export returns 202', jpg: '/q/thumbs/ac-1.jpg', png: '/q/thumbs/ac-1.png', rgb: null }]))
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sec-qa' })
  expect(await ui.find({ type: 'Text', text: 'Export returns 202  /q/thumbs/ac-1.png' })).toBeDefined()
  await ui.unmount()
})

test('desktop draws one Svg carrying the thumbnails', async ($, on) => {
  world(on)
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'sec-qa' })
  expect(await ui.find({ type: 'Svg', alt: '1 QA screenshot: Export returns 202' })).toBeDefined()
  await ui.unmount()
})

test('Open target runs the OS opener with the packet url', async ($, on) => {
  world(on)
  await $.command.run(RUN)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sec-qa' })
  await ui.press({ key: 'qa-target' })
  expect(calls).toContainEqual(['open', 'https://staging.example.com'])
  await ui.unmount()
})
