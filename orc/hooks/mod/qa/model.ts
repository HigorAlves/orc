// QA thumbnails: pure model. `orc-report thumbs` lists them; register.ts loads the bytes.
export type QaThumb = { name: string; criterion: string; jpg: string | null; png: string | null; rgb: string | null }
// A thumbnail with its bytes read: `b64` is the jpeg, `rgb` the 32x16 raw RGB; `png` is the file the terminal Image draws, both base64.
export type QaShot = { name: string; criterion: string; jpg: string | null; png: string | null; b64: string | null; rgb: string | null }
export const SHOTS = 3
// Desktop Svg source is capped at 131,072 chars; leave room for the markup around the images.
export const EMBED_CAP = 120_000

export function parseThumbs(json: string): QaThumb[] {
  try {
    const list = JSON.parse(json)
    return Array.isArray(list)
      ? list.filter(t => t && typeof t.name === 'string').slice(0, SHOTS).map(t => ({
          name: t.name, criterion: String(t.criterion ?? ''), jpg: typeof t.jpg === 'string' ? t.jpg : null, png: typeof t.png === 'string' ? t.png : null, rgb: typeof t.rgb === 'string' ? t.rgb : null }))
      : []
  } catch {
    return []
  }
}

// Up to 3 embeddable shots; the whole set drops to 2, then 1, while the embedded text is over the cap.
export function embeddable(shots: QaShot[], cap = EMBED_CAP): QaShot[] {
  const have = shots.filter(s => s.b64).slice(0, SHOTS)
  for (let n = have.length; n > 1; n--) {
    const set = have.slice(0, n)
    if (set.reduce((sum, s) => sum + (s.b64?.length ?? 0), 0) <= cap) return set
  }
  return have.slice(0, 1)
}

// Terminals that draw real pixels from a file take Image; every other terminal gets half-block Raster.
export const pixelTerminal = (termProgram: string | undefined, kittyWindow: string | undefined) =>
  termProgram === 'ghostty' || termProgram === 'WezTerm' || !!kittyWindow

export const openerFor = (uname: string): string => (/darwin/i.test(uname) ? 'open' : 'xdg-open')

// How "Open target" reaches a browser: the terminal-browser companion's /browser command, else the OS opener.
// Only http(s) URLs from the QA packet are passed on.
export type OpenPlan = { command: { command: string; args: string } } | { argv: string[] }
export function openPlan(url: string | null | undefined, terminalBrowser: boolean, uname: string): OpenPlan | null {
  if (!url || !/^https?:\/\/\S+$/.test(url)) return null
  return terminalBrowser ? { command: { command: 'browser', args: url } } : { argv: [openerFor(uname), url] }
}
