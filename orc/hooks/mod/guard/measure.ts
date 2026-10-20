// Read-only measure plans and summaries for the guarded git commands. Pure:
// the caller runs the argv lists (paths as argv, never shell source) and feeds
// the stdout strings back in plan order.
import type { GuardKind } from './classify'

export type GuardSummary = { headline: string; items: string[]; more: number; total: number; add?: number; del?: number }

const ITEM_MAX = 10
const branchOf = (args: string[]) => {
  const i = args.indexOf('-D')
  if (i >= 0) return args[i + 1]
  return args.filter(a => !a.startsWith('-')).pop()
}

export function measurePlan(kind: GuardKind, args: string[] = []): string[][] {
  switch (kind) {
    case 'reset':
      return [['git', 'status', '--porcelain', '--untracked-files=no'], ['git', 'diff', '--shortstat', 'HEAD']]
    case 'clean': {
      const flags = ['-n']
      if (args.some(a => /^-[a-zA-Z]*d/.test(a))) flags.push('-d')
      if (args.some(a => /^-[a-zA-Z]*x/.test(a))) flags.push('-x')
      return [['git', 'clean', ...flags]]
    }
    case 'branch': {
      // The name comes from the model's command: never let it reach git as an
      // option (`--output=<file>` truncates files before the user is asked).
      const name = branchOf(args)
      if (!name || name.startsWith('-')) return []
      const range = ['--not', 'HEAD', '--remotes', '--not', '--end-of-options', name]
      return [['git', 'rev-list', '--count', ...range], ['git', 'log', '--oneline', '-n', String(ITEM_MAX), ...range]]
    }
    case 'push':
      return [['git', 'rev-parse', '--abbrev-ref', '@{u}'], ['git', 'rev-list', '--count', 'HEAD..@{u}'], ['git', 'log', '--oneline', '-n', String(ITEM_MAX), 'HEAD..@{u}']]
  }
}

const lines = (s: string | undefined) => (s ?? '').split('\n').map(l => l.trimEnd()).filter(Boolean)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const summary = (headline: string, all: string[], total = all.length): GuardSummary =>
  ({ headline, items: all.slice(0, ITEM_MAX), more: Math.max(0, total - ITEM_MAX), total })
const UNKNOWN: GuardSummary = { headline: 'Could not measure what this would discard', items: [], more: 0, total: 0 }

export function summarize(kind: GuardKind, outputs: string[], args: string[] = []): GuardSummary {
  switch (kind) {
    case 'reset': {
      const files = lines(outputs[0]).map(l => l.slice(3))
      const stat = outputs[1] ?? ''
      const out = files.length === 0
        ? summary('Nothing uncommitted to discard', [])
        : summary(`Would discard uncommitted changes in ${plural(files.length, 'file')}`, files)
      const add = /(\d+) insertion/.exec(stat), del = /(\d+) deletion/.exec(stat)
      if (add) out.add = Number(add[1])
      if (del) out.del = Number(del[1])
      return out
    }
    case 'clean': {
      const paths = lines(outputs[0]).map(l => l.replace(/^Would remove /, ''))
      return paths.length === 0 ? summary('No untracked paths to delete', []) : summary(`Would delete ${plural(paths.length, 'untracked path')}`, paths)
    }
    case 'branch': {
      const name = branchOf(args), count = parseInt((outputs[0] ?? '').trim(), 10)
      if (!name || Number.isNaN(count)) return UNKNOWN
      return count > 0
        ? summary(`${plural(count, 'commit')} only on ${name} would become unreachable`, lines(outputs[1]), count)
        : summary(`Every commit on ${name} is reachable from HEAD or a remote`, [])
    }
    case 'push': {
      const upstream = (outputs[0] ?? '').trim(), count = parseInt((outputs[1] ?? '').trim(), 10)
      if (!upstream || Number.isNaN(count)) return UNKNOWN
      return count > 0
        ? summary(`Would drop ${plural(count, 'commit')} from ${upstream}`, lines(outputs[2]), count)
        : summary(`No remote commits would be lost on ${upstream}`, [])
    }
  }
}
