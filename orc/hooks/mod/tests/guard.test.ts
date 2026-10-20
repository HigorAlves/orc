import { expect, test } from 'claude-code/testing'
import { classify } from '../guard/classify'
import { measurePlan, summarize } from '../guard/measure'
import { guardText } from '../guard/text'
import { guardSvg } from '../guard/svg'

const HIT: Array<[string, string, string | null]> = [
  ['git reset --hard', 'reset', null],
  ['git reset --hard HEAD~1', 'reset', null],
  ['npm test && git reset --hard', 'reset', null],
  ['git -C ../x reset --hard', 'reset', '../x'],
  ['git -c core.x=1 reset --hard', 'reset', null],
  ['FOO=1 git reset --hard', 'reset', null],
  ['cd sub && git clean -fd', 'clean', 'sub'],
  ['git clean -fdx', 'clean', null],
  ['git clean -df', 'clean', null],
  ['git clean --force', 'clean', null],
  ['git branch -D feat', 'branch', null],
  ['git branch --delete --force feat', 'branch', null],
  ['git push --force origin main', 'push', null],
  ['git push origin feat -f', 'push', null],
  ['(cd sub && git reset --hard)', 'reset', 'sub'],
  ['(cd sub) && git reset --hard', 'reset', null],
  ['pushd lib && git push -f', 'push', 'lib'],
  ['cd a && cd b && git reset --hard', 'reset', 'a/b'],
  ['cd /abs && cd rel && git reset --hard', 'reset', '/abs/rel'],
  ['cd a && git -C b clean -f', 'clean', 'a/b'],
]
for (const [cmd, kind, cwd] of HIT) {
  test(`classify hits: ${cmd}`, () => {
    const c = classify(cmd)
    expect(c?.kind).toBe(kind)
    expect(c?.cwd).toBe(cwd)
  })
}

const MISS = [
  'git push --force-with-lease', 'git push origin feat', 'git branch -d x', 'git branch', 'git clean -n',
  'git reset --soft HEAD~1', 'git reset HEAD file', 'echo "git reset --hard"', "git commit -m 'x; git reset --hard'",
  'git status', 'ls -f', '',
]
for (const cmd of MISS) {
  test(`classify ignores: ${cmd}`, () => {
    expect(classify(cmd)).toBeNull()
  })
}

test('classify keeps the trailing args', () => {
  expect(classify('git branch -D feat-x')?.args).toEqual(['-D', 'feat-x'])
  expect(classify('git clean -fd')?.args).toEqual(['-fd'])
})

test('measurePlan is read-only argv for every kind', () => {
  const readOnly = new Set(['status', 'diff', 'rev-list', 'log', 'rev-parse', 'clean'])
  for (const kind of ['reset', 'clean', 'branch', 'push'] as const) {
    const plan = measurePlan(kind, kind === 'branch' ? ['-D', 'feat-x'] : kind === 'clean' ? ['-fdx'] : [])
    expect(plan.length > 0).toBe(true)
    for (const argv of plan) {
      expect(argv[0]).toBe('git')
      expect(readOnly.has(argv[1])).toBe(true)
      if (argv[1] === 'clean') expect(argv).toContain('-n')
    }
  }
  expect(measurePlan('reset')[0]).toEqual(['git', 'status', '--porcelain', '--untracked-files=no'])
  expect(measurePlan('reset')[1]).toEqual(['git', 'diff', '--shortstat', 'HEAD'])
  expect(measurePlan('clean', ['-fdx'])[0]).toEqual(['git', 'clean', '-n', '-d', '-x'])
  expect(measurePlan('clean', ['-f'])[0]).toEqual(['git', 'clean', '-n'])
  expect(measurePlan('branch', ['-D', 'feat-x'])[0]).toEqual(['git', 'rev-list', '--count', 'feat-x', '--not', 'HEAD', '--remotes'])
  expect(measurePlan('push')[1]).toEqual(['git', 'rev-list', '--count', 'HEAD..@{u}'])
})

const porcelain = (n: number) => Array.from({ length: n }, (_, i) => ` M src/f${i}.ts`).join('\n')

test('summarize reset: files, capped items, diff stats', () => {
  const s = summarize('reset', [porcelain(15) + '\n', ' 15 files changed, 120 insertions(+), 30 deletions(-)\n'])
  expect(s.headline).toBe('Would discard uncommitted changes in 15 files')
  expect(s.items.length).toBe(10)
  expect(s.items[0]).toBe('src/f0.ts')
  expect(s.more).toBe(5)
  expect(s.add).toBe(120)
  expect(s.del).toBe(30)
})

test('summarize reset: one file is singular, none says nothing to discard', () => {
  expect(summarize('reset', [' M a.ts\n', '']).headline).toBe('Would discard uncommitted changes in 1 file')
  expect(summarize('reset', ['', '']).headline).toBe('Nothing uncommitted to discard')
})

test('summarize clean: untracked paths', () => {
  const s = summarize('clean', ['Would remove a.log\nWould remove tmp/\n'])
  expect(s.headline).toBe('Would delete 2 untracked paths')
  expect(s.items).toEqual(['a.log', 'tmp/'])
  expect(summarize('clean', ['']).headline).toBe('No untracked paths to delete')
})

test('summarize branch: commits only on the branch', () => {
  const s = summarize('branch', ['3\n', 'abc1 one\nabc2 two\nabc3 three\n'], ['-D', 'feat-x'])
  expect(s.headline).toBe('3 commits only on feat-x would become unreachable')
  expect(s.items.length).toBe(3)
  expect(summarize('branch', ['0\n', ''], ['-D', 'feat-x']).headline).toBe('Every commit on feat-x is reachable from HEAD or a remote')
})

test('summarize push --force: commits dropped from the remote branch', () => {
  const s = summarize('push', ['origin/feat-x\n', '3\n', 'a1 one\na2 two\na3 three\n'])
  expect(s.headline).toBe('Would drop 3 commits from origin/feat-x')
  expect(s.items).toEqual(['a1 one', 'a2 two', 'a3 three'])
  expect(summarize('push', ['origin/feat-x\n', '1\n', 'a1 one\n']).headline).toBe('Would drop 1 commit from origin/feat-x')
  expect(summarize('push', ['origin/feat-x\n', '0\n', '']).headline).toBe('No remote commits would be lost on origin/feat-x')
})

test('summarize with unreadable output stays honest', () => {
  expect(summarize('push', ['', '', '']).headline).toBe('Could not measure what this would discard')
  expect(summarize('branch', ['', ''], ['-D', 'x']).headline).toBe('Could not measure what this would discard')
})

test('guardText is at most 4 lines and leads with the headline', () => {
  const s = summarize('reset', [porcelain(15), ' 15 files changed, 120 insertions(+), 30 deletions(-)'])
  const lines = guardText(s)
  expect(lines.length <= 4).toBe(true)
  expect(lines[0]).toBe('Would discard uncommitted changes in 15 files')
  expect(lines.join('\n')).toContain('+120 -30')
  expect(lines.join('\n')).toContain('(+10 more)')
  expect(guardText(summarize('clean', [''])).length).toBe(1)
})

test('guardSvg draws change bars within the engine limit', () => {
  const s = summarize('reset', [porcelain(15), ' 15 files changed, 120 insertions(+), 30 deletions(-)'])
  const svg = guardSvg(s, 80)
  expect(svg === null).toBe(false)
  expect((svg ?? '').length <= 131_072).toBe(true)
  expect(svg).toContain('Would discard uncommitted changes in 15 files')
  expect(svg).toContain('class="f-err"')
  expect(svg).toContain('class="f-ok"')
  expect(guardSvg(s, 80)?.startsWith('<svg ')).toBe(true)
})

test('guardSvg escapes hostile item text', () => {
  const svg = guardSvg(summarize('clean', ['Would remove <script>x</script>\n']), 80)
  expect(svg).toContain('&lt;script&gt;')
  expect(svg).not.toContain('<script>')
})
