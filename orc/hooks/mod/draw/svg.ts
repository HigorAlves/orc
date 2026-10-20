import { PALETTE, type Slot } from './palette'
export const SVG_MAX = 131_072
export const esc = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const px = (columns: number) => Math.max(1, Math.round(columns * 8))
export const textWidth = (s: string, size = 12) => Math.round(s.length * size * 7 / 12)
const slots = Object.keys(PALETTE) as Slot[]
const rules = (mode: 'light' | 'dark') => slots.map(k => `.f-${k}{fill:${PALETTE[k][mode]}}.s-${k}{stroke:${PALETTE[k][mode]}}`).join('')
export const FONT = '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
export function doc(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}"><style>${rules('light')}@media (prefers-color-scheme: dark){${rules('dark')}}</style>${body}</svg>`
}
export const fitSvg = (s: string): string | null => (s.length <= SVG_MAX ? s : null)
export const rect = (o: { x: number; y: number; w: number; h: number; r?: number; slot: Slot; opacity?: number }) =>
  `<rect x="${o.x}" y="${o.y}" width="${Math.max(0, o.w)}" height="${o.h}" rx="${o.r ?? 3}" class="f-${o.slot}"${o.opacity != null ? ` opacity="${o.opacity}"` : ''}/>`
export const text = (o: { x: number; y: number; s: string; size?: number; slot?: Slot; weight?: number; anchor?: 'start' | 'end' | 'middle' }) =>
  `<text x="${o.x}" y="${o.y}" font-size="${o.size ?? 12}" class="f-${o.slot ?? 'ink'}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(o.s)}</text>`
export function bar(o: { x: number; y: number; w: number; h: number; value: number; slot?: Slot }) {
  const v = Math.min(1, Math.max(0, o.value))
  return rect({ x: o.x, y: o.y, w: o.w, h: o.h, slot: 'line' }) + rect({ x: o.x, y: o.y, w: Math.round(o.w * v), h: o.h, slot: o.slot ?? 'ok' })
}
export function segments(o: { x: number; y: number; w: number; h: number; done: number; running: number; total: number }) {
  const n = Math.max(1, o.total), gap = 3, sw = (o.w - gap * (n - 1)) / n
  return Array.from({ length: n }, (_, i) => rect({ x: Math.round(o.x + i * (sw + gap)), y: o.y, w: Math.round(sw), h: o.h,
    slot: i < o.done ? 'ok' : i < o.done + o.running ? 'warn' : 'line', opacity: i >= o.done && i < o.done + o.running ? 0.75 : undefined })).join('')
}
export function ring(o: { cx: number; cy: number; r: number; value: number; slot?: Slot }) {
  const v = Math.min(0.999, Math.max(0, o.value)), a = v * 2 * Math.PI
  const x = o.cx + o.r * Math.sin(a), y = o.cy - o.r * Math.cos(a)
  return `<circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="none" class="s-line" stroke-width="3"/>` +
    `<path d="M${o.cx} ${o.cy - o.r}A${o.r} ${o.r} 0 ${v > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}" fill="none" class="s-${o.slot ?? 'ok'}" stroke-width="3" stroke-linecap="round"/>`
}
export function chip(o: { x: number; y: number; label: string; tone: Slot }) {
  const w = textWidth(o.label, 11) + 14
  return rect({ x: o.x, y: o.y, w, h: 18, r: 9, slot: o.tone, opacity: 0.16 }) + text({ x: o.x + 7, y: o.y + 13, s: o.label, size: 11, slot: o.tone, weight: 600 })
}
export const chipWidth = (label: string) => textWidth(label, 11) + 14
