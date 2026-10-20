import { expect, test } from 'claude-code/testing'
import { PALETTE, termColor } from '../draw/palette'
import { isRich } from '../draw/surface'
import { bar, chip, doc, esc, fitSvg, px, ring, segments, textWidth } from '../draw/svg'

test('esc escapes markup', () => {
  expect(esc('<a&"b">')).toBe('&lt;a&amp;&quot;b&quot;&gt;')
})

test('doc wraps a body with its size and a dark-mode style', () => {
  const s = doc(320, 28, '<g/>')
  expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="28" viewBox="0 0 320 28"')).toBe(true)
  expect(s).toContain('prefers-color-scheme: dark')
  expect(s.endsWith('<g/></svg>')).toBe(true)
})

test('segments draws one rect per slice', () => {
  const s = segments({ x: 0, y: 0, w: 140, h: 8, done: 3, running: 2, total: 7 })
  expect((s.match(/<rect/g) ?? []).length).toBe(7)
  expect((s.match(/class="f-ok"/g) ?? []).length).toBe(3)
  expect((s.match(/class="f-warn"/g) ?? []).length).toBe(2)
})

test('bar clamps the fill to 0..1', () => {
  expect(bar({ x: 0, y: 0, w: 100, h: 6, value: 1.7 })).toContain('width="100"')
  expect(bar({ x: 0, y: 0, w: 100, h: 6, value: -1 })).toContain('width="0"')
})

test('ring draws a track and an arc', () => {
  expect((ring({ cx: 10, cy: 10, r: 8, value: 0.38 }).match(/<(circle|path)/g) ?? []).length).toBe(2)
})

test('chip escapes its label', () => {
  expect(chip({ x: 0, y: 0, label: 'QA <x>', tone: 'ok' })).toContain('QA &lt;x&gt;')
})

test('fitSvg refuses markup over the engine limit', () => {
  expect(fitSvg('<svg>' + 'x'.repeat(200_000) + '</svg>')).toBeNull()
  expect(fitSvg('<svg/>')).toBe('<svg/>')
})

test('px maps terminal columns to css px', () => {
  expect(px(80)).toBe(640)
})

test('textWidth estimates 7px per char at 12px', () => {
  expect(textWidth('abcd', 12)).toBe(28)
})

test('palette exposes svg hex pairs and terminal names for every slot', () => {
  for (const slot of ['ok', 'err', 'warn', 'info', 'muted', 'accent'] as const) {
    expect(PALETTE[slot].light).toMatch(/^#[0-9a-f]{6}$/)
    expect(PALETTE[slot].dark).toMatch(/^#[0-9a-f]{6}$/)
    expect(typeof termColor(slot)).toBe('string')
  }
})

test('isRich: terminal draws text, every remote surface draws svg', () => {
  expect(isRich('terminal')).toBe(false)
  expect(isRich('desktop')).toBe(true)
  expect(isRich('vscode')).toBe(true)
  expect(isRich('mobile')).toBe(true)
  expect(isRich(null)).toBe(false)
})
