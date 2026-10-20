import { expect, test } from 'claude-code/testing'
import { unifiedDiff } from '../replay/diff'
import { REPLAY_INITIAL, recordEdit, replayView, sliceLabel, type ReplayState } from '../replay/model'
import { replayAlt, replaySvg } from '../replay/svg'
import { replayText } from '../replay/text'
import { SVG_MAX } from '../draw/svg'

const edit = (sliceId: number, n = 1, extra = {}) => ({ sliceId, path: 'a.ts', tool: 'Edit', old: 'x', new: `y${n}`, at: n, ...extra })
const lines = (n: number, tag = 'l') => Array.from({ length: n }, (_, i) => `${tag}${i}`).join('\n')

test('unifiedDiff emits one hunk with context and counts', () => {
  const d = unifiedDiff('a\nb\nc\nd\ne', 'a\nb\nC\nd\ne', 'src/x.ts').text
  expect(d).toBe('--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1,5 +1,5 @@\n a\n b\n-c\n+C\n d\n e')
})

test('unifiedDiff of a new file starts at 0 and of identical text is empty', () => {
  expect(unifiedDiff('', 'one\ntwo\n', 'n.ts').text).toContain('@@ -0,0 +1,2 @@\n+one\n+two')
  expect(unifiedDiff('same', 'same', 'n.ts').text).toBe('')
})

test('unifiedDiff splits distant changes into separate hunks', () => {
  const a = lines(30), b = a.replace('l2\n', 'L2\n').replace('l27\n', 'L27\n')
  expect((unifiedDiff(a, b, 'f').text.match(/^@@ /gm) ?? []).length).toBe(2)
})

test('unifiedDiff falls back to all-removed then all-added above 400 lines', () => {
  const d = unifiedDiff(lines(401, 'a'), lines(401, 'b') + '\nz', 'big').text
  expect(d).toContain('@@ -1,401 +1,402 @@')
  expect((d.match(/^-/gm) ?? []).length).toBe(401 + 1) // 401 removed + the '---' header
  expect(d).not.toMatch(/^ /m)
})

test('unifiedDiff caps at 10,000 chars with header counts that match the body', () => {
  const d = unifiedDiff(lines(300, 'old-line-with-padding-'), lines(300, 'new-line-with-padding-'), 'p').text
  expect(d.length).toBeLessThanOrEqual(10_000)
  const body = d.split('\n').slice(3)
  const m = d.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)!
  expect(body.filter(l => l[0] !== '+').length).toBe(Number(m[2]))
  expect(body.filter(l => l[0] !== '-').length).toBe(Number(m[4]))
})

test('recordEdit appends and counts additions and deletions', () => {
  const s = recordEdit(REPLAY_INITIAL, { sliceId: 1, path: 'a.ts', tool: 'Edit', old: 'a\nb', new: 'a\nB\nC', at: 5 })
  expect(s.edits).toHaveLength(1)
  expect(s.edits[0]).toMatchObject({ sliceId: 1, path: 'a.ts', tool: 'Edit', add: 2, del: 1, at: 5 })
  expect(REPLAY_INITIAL.edits).toHaveLength(0)
})

test('recordEdit keeps the latest 60 edits per slice', () => {
  let s: ReplayState = REPLAY_INITIAL
  for (let i = 0; i < 65; i++) s = recordEdit(s, edit(1, i))
  expect(s.edits).toHaveLength(60)
  expect(s.edits[0].at).toBe(5)
})

test('recordEdit trims the oldest slices past 300 total', () => {
  let s: ReplayState = REPLAY_INITIAL
  for (let slice = 1; slice <= 6; slice++) for (let i = 0; i < 60; i++) s = recordEdit(s, edit(slice, i))
  expect(s.edits.length).toBeLessThanOrEqual(300)
  expect(s.edits.some(e => e.sliceId === 1)).toBe(false)
  expect(s.edits.some(e => e.sliceId === 6)).toBe(true)
})

test('replayView addresses slices and steps, clamping out-of-range', () => {
  let s: ReplayState = REPLAY_INITIAL
  s = recordEdit(s, edit(3, 1)); s = recordEdit(s, edit(3, 2, { path: 'b.ts' })); s = recordEdit(s, edit(7, 3))
  expect(replayView(s, { slice: 0, step: 1 })).toMatchObject({ sliceIdx: 0, sliceCount: 2, step: 1, steps: 2, path: 'b.ts', tool: 'Edit', add: 1, del: 1 })
  expect(replayView(s, { slice: 9, step: 9 })).toMatchObject({ sliceIdx: 1, step: 0, steps: 1 })
  expect(replayView(s, { slice: 0, step: 0 })!.diff).toContain('@@')
  expect(replayView(REPLAY_INITIAL, { slice: 0, step: 0 })).toBeNull()
})

const view = () => replayView(recordEdit(REPLAY_INITIAL, { sliceId: 2, path: 'src/a.ts', tool: 'Edit', old: 'a\nb', new: 'a\nB', at: 1 }), { slice: 0, step: 0 })!

test('replayText draws a header and a diff Code block', () => {
  const els: any = { Box: (p: any) => ({ k: 'Box', ...p }), Text: (p: any) => ({ k: 'Text', ...p }), Code: (p: any) => ({ k: 'Code', ...p }) }
  const t: any = replayText(els, view())
  const flat = JSON.stringify(t)
  expect(flat).toContain('src/a.ts')
  expect(flat).toContain('"format":"diff"')
  expect(replayText({ Box: els.Box, Text: els.Text } as any, view())).toBeTruthy()
})

test('replaySvg draws step pills and colored diff lines within the size cap', () => {
  const s = replaySvg(view(), 56)!
  expect(s.startsWith('<svg')).toBe(true)
  expect(s).toContain('src/a.ts')
  expect(s).toContain('class="f-ok"')
  expect(s).toContain('class="f-err"')
  expect(s.length).toBeLessThanOrEqual(SVG_MAX)
  expect(replayAlt(view())).toContain('src/a.ts')
})

test('replaySvg shows at most 12 diff lines', () => {
  const v = replayView(recordEdit(REPLAY_INITIAL, { sliceId: 1, path: 'f', tool: 'Write', old: '', new: lines(40), at: 1 }), { slice: 0, step: 0 })!
  expect((replaySvg(v, 56)!.match(/data-diff/g) ?? []).length).toBeLessThanOrEqual(12)
})

test('M2 CRLF text splits cleanly and control characters become visible glyphs', () => {
  const crlf = unifiedDiff('a\r\nb\r\n', 'a\r\nB\r\n', 'f').text
  expect(crlf).toBe('--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n a\n-b\n+B')
  const d = unifiedDiff('x', 'a\u0001b\u007fc\rd\u000be\tf', 'f').text
  expect(d).toContain('+a\u2401b\u2421c\u240dd\u240be\tf')
  expect(/[\x00-\x08\x0b-\x1f\x7f]/.test(d)).toBe(false)
})

test('M3 a one-line change in a large file still shows that line', () => {
  const big = Array.from({ length: 800 }, (_, i) => `line ${i}`)
  const changed = big.slice(); changed[400] = 'CHANGED'
  const d = unifiedDiff(big.join('\n'), changed.join('\n'), 'big')
  expect(d.text).toContain('-line 400\n+CHANGED')
  expect(d.add).toBe(1)
  expect(d.del).toBe(1)
  expect(d.text).toContain(' line 399')
})

test('M4 add/del count the whole change, not the capped text', () => {
  const d = unifiedDiff(lines(300, 'old-line-with-padding-'), lines(300, 'new-line-with-padding-'), 'p')
  expect(d.text.length).toBeLessThanOrEqual(10_000)
  expect(d.add).toBe(300)
  expect(d.del).toBe(300)
  const e = recordEdit(REPLAY_INITIAL, { sliceId: 1, path: 'p', tool: 'Write', old: lines(300, 'old-line-with-padding-'), new: lines(300, 'new-line-with-padding-'), at: 1 })
  expect([e.edits[0].add, e.edits[0].del]).toEqual([300, 300])
})

test('sliceLabel names slice 0 as outside slices', () => {
  expect(sliceLabel(0)).toBe('Outside slices')
  expect(sliceLabel(4)).toBe('Slice 4')
})
