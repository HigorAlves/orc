// estimate — list prices as of 2026-10-20, from the claude-api skill's model
// reference (shared/models.md, shared/model-migration.md); verify against it.
// USD per million tokens. Cache writes are priced at the 1-hour rate (2x input),
// the duration Claude Code's cache uses, or the 5-minute rate (1.25x) for a short ttl. Cache reads are 0.1x input, except
// Opus 5.5 at 0.05x and Fable 5.1 at 0.025x. Models the skill lists no price for
// (Haiku 4.5, ...) are absent on purpose: an unknown model costs `null`, never a guess.
export type Price = { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
export type Tokens = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

export const PRICES: readonly (readonly [RegExp, Price])[] = [
  [/^claude-(fable|mythos)-5-1/, { input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20 }],
  [/^claude-(fable|mythos)-5/, { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 }],
  [/^claude-opus-5-5/, { input: 4, output: 20, cacheWrite5m: 5, cacheRead: 0.2, cacheWrite1h: 8 }],
  [/^claude-opus-(5|4-[678])/, { input: 5, output: 25, cacheWrite5m: 6.25, cacheRead: 0.5, cacheWrite1h: 10 }],
  [/^claude-sonnet-5/, { input: 2, output: 10, cacheWrite5m: 2.5, cacheRead: 0.2, cacheWrite1h: 4 }],
  [/^claude-sonnet-4-6/, { input: 3, output: 15, cacheWrite5m: 3.75, cacheRead: 0.3, cacheWrite1h: 6 }],
]

const priceOf = (model: string): Price | null => PRICES.find(([re]) => re.test(model))?.[1] ?? null

// Dollars for one usage record; null when the model has no listed price.
export function costOf(u: Tokens, model: string): number | null {
  const p = priceOf(model)
  if (!p) return null
  return (u.input_tokens * p.input + u.output_tokens * p.output + u.cache_read_input_tokens * p.cacheRead + u.cache_creation_input_tokens * p.cacheWrite1h) / 1e6
}

// Dollars to write `tokens` into the cache afresh (what a cold send re-pays).
// A ttl of 10 minutes or less is the 5-minute cache (1.25x input); longer is the 1-hour cache (2x).
export function rewriteCost(tokens: number, model: string, ttlMs = 3_600_000): number | null {
  const p = priceOf(model)
  return p ? (tokens * (ttlMs <= 600_000 ? p.cacheWrite5m : p.cacheWrite1h)) / 1e6 : null
}
