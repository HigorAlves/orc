// Retro store: candidate list merge and fenced rules.md writes. Pure.
// Similarity thresholds and marker-fenced writes adapted from BayramAnnakov/claude-reflect (MIT).
import { similarity } from './clean'

export type Candidate = {
  id: string
  rule: string
  source: string
  seen: number
  status: 'pending' | 'saved' | 'skipped'
  at: number
}

export type CandidateFile = { schema: 1; items: Candidate[] }

export const START = '<!-- orc:retro:start -->'
export const END = '<!-- orc:retro:end -->'

const SAME = 0.6
const SAVED = 0.8

function idOf(rule: string): string {
  let h = 5381
  for (let i = 0; i < rule.length; i++) h = ((h * 33) ^ rule.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// Bump the closest existing candidate (>= 0.6), skip rules already saved (>= 0.8), else append.
export function mergeCandidate(
  items: Candidate[],
  rule: string,
  ctx: { source: string; at: number; saved?: string[] },
): { items: Candidate[]; alreadySaved: boolean } {
  if ((ctx.saved ?? []).some(s => similarity(s, rule) >= SAVED)) return { items, alreadySaved: true }
  let best = -1, bestScore = 0
  items.forEach((c, i) => {
    const s = similarity(c.rule, rule)
    if (s >= SAME && s > bestScore) { best = i; bestScore = s }
  })
  if (best >= 0) return { items: items.map((c, i) => (i === best ? { ...c, seen: c.seen + 1, at: ctx.at } : c)), alreadySaved: false }
  return { items: [...items, { id: idOf(rule), rule, source: ctx.source, seen: 1, status: 'pending', at: ctx.at }], alreadySaved: false }
}

export const renderRules = (rules: string[]): string => `${START}\n${rules.map(r => `- ${r}\n`).join('')}${END}\n`

const count = (s: string, needle: string): number => s.split(needle).length - 1

// Replace the fenced block; undefined unless exactly one start then one end (never guess).
export function spliceRules(file: string, rules: string[]): string | undefined {
  if (count(file, START) !== 1 || count(file, END) !== 1) return undefined
  const a = file.indexOf(START), b = file.indexOf(END)
  if (b < a) return undefined
  const after = file.slice(b + END.length).replace(/^\n/, '')
  return file.slice(0, a) + renderRules(rules) + after
}
