// Prompt-cache clock: when the cached prefix lapses, what re-writing it costs,
// and the keep-warm ping rules. Pure — register.ts owns the timers and `$`.
import { rewriteCost } from '../prices'

export const COOLING_MS = 15 * 60_000
export const COLD_MIN_TOKENS = 20_000
export const PING_MS = 50 * 60_000

export type CacheView = { phase: 'warm' | 'cooling' | 'cold'; minutesLeft: number; coldFor: number; tokens: number; rewriteUsd: number | null }

export function cacheState(a: { lastAt: number; lastContext: number; model: string; now: number; ttlMs: number }): CacheView {
  const left = a.ttlMs - (a.now - a.lastAt)
  return {
    phase: left <= 0 ? 'cold' : left <= COOLING_MS ? 'cooling' : 'warm',
    minutesLeft: Math.max(0, Math.ceil(left / 60_000)), coldFor: Math.max(0, -left),
    tokens: a.lastContext, rewriteUsd: rewriteCost(a.lastContext, a.model, a.ttlMs),
  }
}

// A request that wrote at least half of the previous (large) context was a cold rewrite.
export const isColdRewrite = (prevContext: number, u: { cache_creation_input_tokens: number }): boolean =>
  prevContext > COLD_MIN_TOKENS && u.cache_creation_input_tokens >= 0.5 * prevContext

// A keep-warm ping that wrote anything near a tenth of what it read means the cache was already gone.
export const pingGone = (u: { cache_creation_input_tokens: number; cache_read_input_tokens: number }): boolean =>
  u.cache_creation_input_tokens > 0 && u.cache_creation_input_tokens >= 0.1 * u.cache_read_input_tokens

// Ping early enough to land inside the ttl: 50 minutes, or ttl minus 10 for a shorter ttl.
export const pingEvery = (ttlMs: number): number => Math.min(PING_MS, Math.max(60_000, ttlMs - 10 * 60_000))

// "2h", "90m", "1h30m" -> ms; anything else (including "off") -> null.
export function parseDuration(s: string): number | null {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(s.trim())
  if (!m || (m[1] == null && m[2] == null)) return null
  const ms = (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60_000
  return ms > 0 ? ms : null
}

export function agoOf(ms: number): string {
  const min = Math.floor(ms / 60_000), h = Math.floor(min / 60)
  return h > 0 ? `${h}h${String(min % 60).padStart(2, '0')}m` : `${Math.max(1, min)}m`
}

export const coldToast = (coldFor: number, tokens: number, usd: number | null): string =>
  `cache went cold ${agoOf(coldFor)} ago · this send re-writes ~${Math.round(tokens / 1000)}k tok${usd != null ? ` ≈ $${usd.toFixed(2)}` : ''}`
