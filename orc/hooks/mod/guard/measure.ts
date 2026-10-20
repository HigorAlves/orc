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

// `git push` args as [remote] [refspec]. Only the bare forms are measurable:
// anything that changes what is pushed (--all, --mirror, --tags, --delete,
// --repo, a refspec with ':' or a third positional) is unknown.
const PUSH_UNKNOWN = new Set(['--all', '--mirror', '--tags', '--delete', '-d', '--prune', '--repo', '-o', '--push-option', '--receive-pack', '--exec'])
function pushShape(args: string[]): { remote?: string; branch?: string } | null {
  if (args.some(a => PUSH_UNKNOWN.has(a) || a.startsWith('--repo=') || a.startsWith('--receive-pack=') || a.startsWith('--exec='))) return null
  const pos = args.filter(a => !a.startsWith('-'))
  if (pos.length > 2 || (pos[1] !== undefined && /[:^~\s]/.test(pos[1]))) return null
  return { remote: pos[0], branch: pos[1] }
}

const GIT = ['git', '--no-optional-locks']

// `reset --hard <target>`: a plain revision, never an option.
const resetTarget = (args: string[]) => args.find(a => !a.startsWith('-'))

// Parsed `git clean` args: the -d/-x/-X flags, exclude patterns, and pathspecs.
function cleanShape(args: string[]) {
  const flags: string[] = [], excludes: string[] = [], paths: string[] = []
  let rest = false
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (rest) paths.push(a)
    else if (a === '--') rest = true
    else if (a === '--exclude' && i + 1 < args.length) excludes.push('--exclude', args[++i])
    else if (a.startsWith('--exclude=')) excludes.push(a)
    else if (/^-[a-zA-Z]+$/.test(a)) {
      if (/d/.test(a) && !flags.includes('-d')) flags.push('-d')
      if (/x/.test(a) && !flags.includes('-x')) flags.push('-x')
      if (/X/.test(a) && !flags.includes('-X')) flags.push('-X')
      if (a.endsWith('e') && i + 1 < args.length) excludes.push('-e', args[++i])
    } else if (!a.startsWith('-')) paths.push(a)
  }
  return { flags, excludes, paths }
}

export function measurePlan(kind: GuardKind, args: string[] = []): string[][] {
  switch (kind) {
    case 'reset': {
      const plan = [[...GIT, 'status', '--porcelain', '--untracked-files=no'], [...GIT, 'diff', '--shortstat', 'HEAD']]
      const target = resetTarget(args)
      if (target) plan.push(['git', 'rev-list', '--count', '--end-of-options', `${target}..HEAD`])
      return plan
    }
    case 'clean': {
      const { flags, excludes, paths } = cleanShape(args)
      return [['git', 'clean', '-n', ...flags, ...excludes, ...(paths.length ? ['--', ...paths] : [])]]
    }
    case 'branch': {
      // The name comes from the model's command: never let it reach git as an
      // option (`--output=<file>` truncates files before the user is asked).
      const name = branchOf(args)
      if (!name || name.startsWith('-')) return []
      const range = ['--not', 'HEAD', '--remotes', '--not', '--end-of-options', name]
      return [['git', 'rev-list', '--count', ...range], ['git', 'log', '--oneline', '-n', String(ITEM_MAX), ...range]]
    }
    case 'push': {
      const shape = pushShape(args)
      if (!shape) return []
      const plan = [['git', 'rev-parse', '--abbrev-ref', '@{u}'], ['git', 'rev-list', '--count', 'HEAD..@{u}'], ['git', 'log', '--oneline', '-n', String(ITEM_MAX), 'HEAD..@{u}']]
      if (shape.branch !== undefined) plan.push(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
      return plan
    }
  }
}

const lines = (s: string | undefined) => (s ?? '').split('\n').map(l => l.trimEnd()).filter(Boolean)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const summary = (headline: string, all: string[], total = all.length): GuardSummary =>
  ({ headline, items: all.slice(0, ITEM_MAX), more: Math.max(0, total - ITEM_MAX), total })
const UNKNOWN: GuardSummary = { headline: 'Could not measure what this would discard', items: [], more: 0, total: 0 }

const baseOf = (dir: string) => dir.replace(/\/+$/, '').split('/').pop() ?? ''

export function summarize(kind: GuardKind, outputs: string[], args: string[] = [], dir?: string | null): GuardSummary {
  const out = summarizeKind(kind, outputs, args)
  const where = dir && dir !== '-' ? baseOf(dir) : ''
  return where ? { ...out, headline: `${out.headline} · in ${where}` } : out
}

function summarizeKind(kind: GuardKind, outputs: string[], args: string[]): GuardSummary {
  switch (kind) {
    case 'reset': {
      const files = lines(outputs[0]).map(l => l.slice(3))
      const stat = outputs[1] ?? ''
      const out = files.length === 0
        ? summary('Nothing uncommitted to discard', [])
        : summary(`Would discard uncommitted changes in ${plural(files.length, 'file')}`, files)
      const drop = parseInt((outputs[2] ?? '').trim(), 10)
      if (drop > 0) out.headline += ` · would drop ${plural(drop, 'local commit')}`
      const add = /(\d+) insertion/.exec(stat), del = /(\d+) deletion/.exec(stat)
      if (add) out.add = Number(add[1])
      if (del) out.del = Number(del[1])
      return out
    }
    case 'clean': {
      const paths = lines(outputs[0]).filter(l => !l.startsWith('Would skip ')).map(l => l.replace(/^Would remove /, ''))
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
      const shape = pushShape(args)
      if (!shape) return UNKNOWN
      if (shape.remote !== undefined && !upstream.startsWith(shape.remote + '/')) return UNKNOWN
      if (shape.branch !== undefined && (upstream !== `${shape.remote}/${shape.branch}` || (outputs[3] ?? '').trim() !== shape.branch)) return UNKNOWN
      return count > 0
        ? summary(`Would drop ${plural(count, 'commit')} from ${upstream}`, lines(outputs[2]), count)
        : summary(`No remote commits would be lost on ${upstream}`, [])
    }
  }
}
