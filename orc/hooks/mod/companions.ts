// Which companion mods are loaded, judged from the plugin names engine.create reports.
export type Companions = { skins: boolean; filetree: boolean; reflect: boolean; youShouldKnow: boolean; terminalBrowser: boolean }
export const COMPANIONS_NONE: Companions = { skins: false, filetree: false, reflect: false, youShouldKnow: false, terminalBrowser: false }
const has = (names: readonly string[], re: RegExp) => names.some(n => re.test(n))
export const companionsOf = (names: readonly string[]): Companions => ({
  skins: has(names, /^(claude-)?skins$/), filetree: has(names, /filetree/), reflect: has(names, /^(claude-)?reflect(-mod)?$/),
  youShouldKnow: has(names, /you-should-know/), terminalBrowser: has(names, /^terminal-browser$/),
})
