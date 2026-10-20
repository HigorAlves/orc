// Pure command classifier for the measured guard. The recognised set matches
// hooks/scripts/pre-destructive-git-check.sh exactly; the cd/pushd/git -C/
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

function joinDir(dir: string | null, arg: string | undefined): string {
  if (arg === undefined || arg === '~' || arg.startsWith('/') || arg.startsWith('~/')) return arg ?? '~'
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

export function classify(cmd: string): Guarded | null {
  let dir: string | null = null
  const scopes: Array<string | null> = []
  const pushed: Array<string | null> = []
  for (const raw of splitSegments(cmd)) {
    const opens = raw.match(/^\s*\(+/)?.[0].trim().length ?? 0
    const closes = raw.replace(/(?:\s*(?:\d*>>?|<)\s*\S+)+\s*$/, '').match(/\)+\s*$/)?.[0].trim().length ?? 0
    for (let k = 0; k < opens; k++) scopes.push(dir)
    const step = segment(raw, dir, pushed)
    if (step && 'hit' in step) return step.hit
    if (step) dir = step.cd
    for (let k = 0; k < closes && scopes.length > 0; k++) dir = scopes.pop() ?? null
  }
  return null
}
