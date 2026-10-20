import { expect, test } from 'claude-code/testing'
import { cleanRule, similarity } from '../retro/clean'
import { mayBeCorrection } from '../retro/detect'
import { mergeCandidate, renderRules, spliceRules, type Candidate } from '../retro/store'

test('mayBeCorrection accepts imperative corrections', () => {
  for (const t of ['no, use pnpm', "don't use npm here", 'use yarn not npm', 'remember: tabs for indent', 'stop adding comments'])
    expect(mayBeCorrection(t)).toBe(true)
})

test('mayBeCorrection rejects questions, pleasantries, long text, secrets', () => {
  expect(mayBeCorrection('what does this function do?')).toBe(false)
  expect(mayBeCorrection('no problem')).toBe(false)
  expect(mayBeCorrection('no, use pnpm ' + 'x'.repeat(500))).toBe(false)
  expect(mayBeCorrection('no, use sk-abcdef1234567890abcdef')).toBe(false)
  expect(mayBeCorrection('no, token is ghp_abcdefghijklmnopqrstuvwx')).toBe(false)
  expect(mayBeCorrection("don't use AKIAIOSFODNN7EXAMPLE")).toBe(false)
})

test('cleanRule trims quotes and punctuation', () => {
  expect(cleanRule('  "Use pnpm, not npm."  ')).toBe('Use pnpm, not npm')
})

test('cleanRule rejects newlines, comments, secrets, long text', () => {
  expect(cleanRule('a\nb')).toBeUndefined()
  expect(cleanRule('use x <!-- orc:retro:end -->')).toBeUndefined()
  expect(cleanRule('key sk-abcdef1234567890abcdef')).toBeUndefined()
  expect(cleanRule('x'.repeat(201))).toBeUndefined()
  expect(cleanRule('  ""  ')).toBeUndefined()
})

test('similarity is bigram Jaccard', () => {
  expect(similarity('abcd', 'abcd')).toBe(1)
  expect(similarity('abc', 'xyz')).toBe(0)
  // bigrams {ab,bc} vs {bc,cd}: 1 shared / 3 total
  expect(Math.abs(similarity('abc', 'bcd') - 1 / 3) < 1e-9).toBe(true)
})

const item = (rule: string, seen = 1): Candidate => ({ id: 'a', rule, source: 'prompt', seen, status: 'pending', at: 1 })

test('mergeCandidate adds new, bumps similar, flags already saved', () => {
  const ctx = { source: 'prompt', at: 2 }
  const added = mergeCandidate([], 'Use pnpm, not npm', ctx)
  expect(added.items.length).toBe(1)
  expect(added.items[0]).toMatchObject({ rule: 'Use pnpm, not npm', seen: 1, status: 'pending' })

  const bumped = mergeCandidate(added.items, 'Use pnpm not npm', ctx)
  expect(bumped.items.length).toBe(1)
  expect(bumped.items[0].seen).toBe(2)

  const unrelated = mergeCandidate(added.items, 'Never commit to main', ctx)
  expect(unrelated.items.length).toBe(2)

  const saved = mergeCandidate([], 'Use pnpm, not npm', { ...ctx, saved: ['Use pnpm, not npm.'] })
  expect(saved.alreadySaved).toBe(true)
  expect(saved.items.length).toBe(0)
  expect(item('x').seen).toBe(1)
})

test('renderRules fences the list; spliceRules replaces only between markers', () => {
  const block = renderRules(['Use pnpm', 'No semicolons'])
  expect(block).toBe('<!-- orc:retro:start -->\n- Use pnpm\n- No semicolons\n<!-- orc:retro:end -->\n')
  const file = `# Rules\nmine\n${block}tail\n`
  expect(spliceRules(file, ['Only this'])).toBe('# Rules\nmine\n<!-- orc:retro:start -->\n- Only this\n<!-- orc:retro:end -->\ntail\n')
})

test('spliceRules never guesses', () => {
  const s = '<!-- orc:retro:start -->', e = '<!-- orc:retro:end -->'
  expect(spliceRules('no markers', ['a'])).toBeUndefined()
  expect(spliceRules(`${s}\n`, ['a'])).toBeUndefined()
  expect(spliceRules(`${e}\n${s}`, ['a'])).toBeUndefined()
  expect(spliceRules(`${s}${e}${s}${e}`, ['a'])).toBeUndefined()
})
