// Pure command classifier for the measured guard. The recognised set matches
// hooks/scripts/pre-destructive-git-check.sh in kinds, but not in reach: the
// shell floor also sees through `bash -c '…'` and ssh quotes, while classify
// treats quoted text as prose, so those commands get the floor's confirmation
// without a measured summary, by design. The cd/pushd/git -C/
// subshell scoping is adapted, with changes, from Blast Radius (Apache-2.0, see
// THIRD-PARTY-LICENSES.md).
export type GuardKind = 'reset' | 'clean' | 'branch' | 'push'
export type Guarded = { kind: GuardKind; cwd: string | null; args: string[] }

const SPLIT_PUNCT = new Set([';', '&', '|', '\n'])

// Split on ; & | newline outside quotes; a quoted mention is prose, not a command.
function splitSegments(cmd: string): string[] {
  const out: string[] = []
  let cur = '', quote: string | null = null
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]
    if (quote) {
      cur += ch
      if (ch === '\\' && quote === '"' && i + 1 < cmd.length) cur += cmd[++i]
      else if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") { quote = ch; cur += ch }
    else if (ch === '\\' && i + 1 < cmd.length) { cur += ch + cmd[++i] }
    else if (SPLIT_PUNCT.has(ch)) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

function tokenize(text: string): string[] {
  const words: string[] = []
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) words.push(m[1] ?? m[2] ?? m[3])
  return words
}

// '-' = unknown: home (`cd`, `cd ~`, `cd ~/x`) and anything relative to an unknown dir.
function joinDir(dir: string | null, arg: string | undefined): string {
  if (arg === undefined || arg === '~' || arg.startsWith('~/')) return '-'
  if (arg.startsWith('/')) return arg
  if (dir === '-') return '-'
  return dir ? `${dir.replace(/\/$/, '')}/${arg}` : arg
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/

function match(sub: string | undefined, rest: string[], cwd: string | null): Guarded | null {
  if (sub === 'reset' && rest.includes('--hard')) return { kind: 'reset', cwd, args: rest }
  if (sub === 'clean' && rest.some(a => /^-[a-eg-zA-Z]*f/.test(a) || a === '--force')) return { kind: 'clean', cwd, args: rest }
  if (sub === 'branch' && (rest.includes('-D') || (rest.includes('--delete') && rest.includes('--force')))) return { kind: 'branch', cwd, args: rest }
  if (sub === 'push' && rest.some(a => a === '--force' || a === '-f')) return { kind: 'push', cwd, args: rest }
  return null
}

type Step = { hit: Guarded } | { cd: string | null } | null

function segment(raw: string, dir: string | null, pushed: Array<string | null>): Step {
  const words = tokenize(raw.trim().replace(/^[({]+\s*/, '').replace(/\s*[)}]+$/, ''))
  while (words.length > 0 && (ASSIGN.test(words[0]) || words[0] === 'command' || words[0] === 'exec' || words[0] === 'then' || words[0] === 'do' || words[0] === '!')) words.shift()
  const [first, ...args] = words
  if (first === undefined) return null
  if (first === 'cd') return { cd: args[0] === '-' ? '-' : joinDir(dir, args[0]) }
  if (first === 'pushd') { pushed.push(dir); return { cd: joinDir(dir, args[0]) } }
  if (first === 'popd') return { cd: pushed.length > 0 ? pushed.pop() ?? null : '-' }
  if (first !== 'git') return null
  let gitDir = dir, i = 0
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '-C' && i + 1 < args.length) { gitDir = joinDir(gitDir, args[i + 1]); i += 2 }
    else if (args[i] === '-c' && i + 1 < args.length) i += 2
    else i += 1
  }
  const hit = match(args[i], args.slice(i + 1), gitDir)
  return hit ? { hit } : null
}

// Trailing `)` count after any trailing redirections: a backwards token scan
// (a nested-quantifier regex here backtracked exponentially).
const REDIR_ATTACHED = /^(?:\d*>>?|<)\S+$/, REDIR_OP = /^(?:\d*>>?|<)$/
function closingParens(raw: string): number {
  const trailing = (w: string) => { let n = 0; while (n < w.length && w[w.length - 1 - n] === ')') n++; return n }
  const words = raw.trim().split(/\s+/)
  const own = trailing(words[words.length - 1] ?? '') // a paren glued to the redirect target still closes
  while (words.length > 0) {
    const last = words[words.length - 1]
    if (REDIR_ATTACHED.test(last)) words.pop()
    else if (words.length > 1 && REDIR_OP.test(words[words.length - 2])) words.length -= 2
    else break
  }
  return Math.max(own, trailing(words[words.length - 1] ?? ''))
}

export function classify(cmd: string): Guarded | null {
  let dir: string | null = null
  const scopes: Array<string | null> = []
  const pushed: Array<string | null> = []
  for (const raw of splitSegments(cmd)) {
    const opens = raw.match(/^\s*\(+/)?.[0].trim().length ?? 0
    const closes = closingParens(raw)
    for (let k = 0; k < opens; k++) scopes.push(dir)
    const step = segment(raw, dir, pushed)
    if (step && 'hit' in step) return step.hit
    if (step) dir = step.cd
    for (let k = 0; k < closes && scopes.length > 0; k++) dir = scopes.pop() ?? null
  }
  return null
}
