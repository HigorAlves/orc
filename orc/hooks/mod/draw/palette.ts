// One palette, two forms: hex pairs for SVG (light/dark via a CSS media query
// inside the SVG) and named colors for terminal Text.
export type Slot = 'ok' | 'err' | 'warn' | 'info' | 'muted' | 'accent' | 'ink' | 'surface' | 'line' | 'violet'
export const PALETTE: Record<Slot, { light: string; dark: string }> = {
  ok: { light: '#4f8f2f', dark: '#7fc057' }, err: { light: '#c94a3f', dark: '#e57a70' },
  warn: { light: '#c98a12', dark: '#e5b55c' }, info: { light: '#3a72b0', dark: '#7fb3e3' },
  muted: { light: '#6b7466', dark: '#9aa294' }, accent: { light: '#4f8f2f', dark: '#7fc057' },
  ink: { light: '#1d211b', dark: '#e6e9e2' }, surface: { light: '#ffffff', dark: '#252a23' },
  line: { light: '#dfe3d9', dark: '#343a31' }, violet: { light: '#8455c2', dark: '#b48ce6' },
}
const TERM: Record<Slot, string> = { ok: 'green', err: 'red', warn: 'yellow', info: 'blue', muted: 'gray', accent: 'green', ink: 'white', surface: 'black', line: 'gray', violet: 'magenta' }
export const termColor = (slot: Slot) => TERM[slot]
