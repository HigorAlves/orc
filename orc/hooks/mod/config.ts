import type { PluginOptions } from 'claude-code'
export type Features = {
  progressBand: boolean; guardMeasure: boolean; replay: boolean; cacheCliff: 'warn' | 'off'; cacheTtlMs: number
  corrections: boolean; sentinel: 'off' | 'checks' | 'model'; sentinelEvery: number
}
export const DEFAULTS: Features = { progressBand: true, guardMeasure: true, replay: true, cacheCliff: 'warn', cacheTtlMs: 60 * 60_000, corrections: true, sentinel: 'model', sentinelEvery: 12 }
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
export function parseFeatures(options: PluginOptions | Record<string, unknown>): Features {
  return {
    progressBand: bool(options.progress_band, DEFAULTS.progressBand), guardMeasure: bool(options.guard_measure, DEFAULTS.guardMeasure),
    replay: bool(options.replay, DEFAULTS.replay), cacheCliff: pick(options.cache_cliff, ['warn', 'off'] as const, 'warn'),
    cacheTtlMs: Math.max(1, num(options.cache_ttl_minutes, 60)) * 60_000, corrections: bool(options.corrections, DEFAULTS.corrections),
    sentinel: pick(options.sentinel, ['off', 'checks', 'model'] as const, 'model'), sentinelEvery: Math.max(4, Math.round(num(options.sentinel_every, 12))),
  }
}
