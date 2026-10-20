// Rule cleaning and similarity. Pure. Adapted from BayramAnnakov/claude-reflect (MIT).

export const MAX_RULE = 200

// Linear patterns only: fixed prefixes, then one bounded or single-class run.
const SECRET = new RegExp([
  '\\b(?:sk-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{10,}|(?:AKIA|ASIA)[A-Z0-9]{12,}|xox[abprse]-[A-Za-z0-9-]{10,})',
  '\\b[sr]k_live_[A-Za-z0-9]{10,}',
  '\\bgithub_pat_[A-Za-z0-9_]{20,}',
  '\\bglpat-[A-Za-z0-9_-]{16,}',
  '\\bAIza[A-Za-z0-9_-]{30,}',
  '\\bnpm_[A-Za-z0-9]{30,}',
  '\\bxapp-[A-Za-z0-9-]{10,}',
  '\\beyJ[A-Za-z0-9_-]{5,}\\.eyJ[A-Za-z0-9_-]{5,}',
  '-----BEGIN [A-Z ]{0,30}PRIVATE KEY',
  '[a-z][a-z0-9+.-]{1,20}://[^\\s/:@]{1,100}:[^\\s/@]{1,100}@',
].join('|'))

export const hasSecret = (s: string): boolean => SECRET.test(s)

// A model-proposed rule, made safe to store; undefined when it can't be.
export function cleanRule(s: string): string | undefined {
  if (/[\r\n]/.test(s.trim()) || s.includes('<!--') || hasSecret(s)) return undefined
  const rule = s.trim().replace(/^["'`“”‘’\s]+|["'`“”‘’\s.;:,!]+$/g, '')
  return rule === '' || rule.length > MAX_RULE ? undefined : rule
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const bigrams = (s: string): Set<string> => {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

// Bigram Jaccard over normalised text, 0..1.
export function similarity(a: string, b: string): number {
  const x = norm(a), y = norm(b)
  if (x === y) return 1
  const A = bigrams(x), B = bigrams(y)
  let shared = 0
  for (const g of A) if (B.has(g)) shared++
  const union = A.size + B.size - shared
  return union === 0 ? 0 : shared / union
}
