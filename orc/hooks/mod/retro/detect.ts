// Cheap first-pass filter: is this prompt possibly a correction? Pure.
// Regex families adapted from BayramAnnakov/claude-reflect (MIT).
import { hasSecret } from './clean'

const MAX_LEN = 500

const CORRECTION: RegExp[] = [
  /^no[,.!:;—–-]+\s*\S/i,
  /^no\s+\S/i,
  /^(?:don't|do not)\b/i,
  /^(?:stop|never)\b/i,
  /that(?:'s| is) (?:wrong|incorrect)/i,
  /^actually[,. ]/i,
  /^I (?:meant|said|told you|already told)\b/i,
  /\buse .{1,30} not\b/i,
  /\bremember:/i,
]

const GUARDRAIL: RegExp[] = [
  /don't (?:add|include|create) .{1,40} unless/i,
  /only (?:change|modify|edit|touch) what I (?:asked|requested|said)/i,
  /leave .{1,30} (?:alone|unchanged|as is)/i,
  /(?:minimal|minimum|only necessary) changes/i,
]

const NOT_CORRECTION: RegExp[] = [
  /[?？]$/,
  /^(?:please|can you|could you|would you|help me)\b/i,
  /^I (?:need|want|would like)\b/i,
  /^no\s+(?:problem|worries|need|way|idea|rush|hurry|pressure|stress)\b/i,
  /^no\s+(?:it|that|this|we|i|you|they)\s+(?:works?|worked|looks?|seems?|sounds?|is|was|'s)\b/i,
  /^no\s+[\w-]+\s+(?:appeared|happened|occurred|showed|returned|existed|changed|matched|was|were)\b/i,
  /^(?:don't|do not)\s+(?:worry|mind|bother)\b/i,
  /^never\s+mind\b/i,
  /^stop\s+worrying\b/i,
]

export function mayBeCorrection(text: string): boolean {
  const t = text.trim()
  if (t === '' || t.length > MAX_LEN || hasSecret(t)) return false
  if (/^[<[{]/.test(t)) return false
  if (NOT_CORRECTION.some(r => r.test(t))) return false
  return CORRECTION.some(r => r.test(t)) || GUARDRAIL.some(r => r.test(t))
}
