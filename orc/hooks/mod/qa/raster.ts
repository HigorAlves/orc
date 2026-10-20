// Half-block thumbnails for terminals without pixel graphics: 32x16 RGB -> 32x8 cells of ▀ (fg top, bg bottom).
export const RASTER_COLUMNS = 32
export const RASTER_ROWS = 8
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function decode64(b64: string): number[] {
  const out: number[] = []
  let acc = 0, bits = 0
  for (const ch of b64) {
    const v = ALPHABET.indexOf(ch)
    if (v < 0) continue // '=' padding and whitespace
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255) }
  }
  return out
}

export function encode64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63]
      + (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? ALPHABET[n & 63] : '=')
  }
  return out
}

const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]

// `cells` for a Raster: columns*rows little-endian u32 triplets [codePoint, fg, bg]; null when the bytes are not 32x16 RGB.
export function halfBlocks(rgbB64: string): string | null {
  const px = decode64(rgbB64)
  if (px.length !== RASTER_COLUMNS * RASTER_ROWS * 2 * 3) return null
  const at = (x: number, y: number) => {
    const i = (y * RASTER_COLUMNS + x) * 3
    return (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]
  }
  const bytes: number[] = []
  for (let r = 0; r < RASTER_ROWS; r++)
    for (let c = 0; c < RASTER_COLUMNS; c++) bytes.push(...u32(0x2580), ...u32(at(c, 2 * r)), ...u32(at(c, 2 * r + 1)))
  return encode64(bytes)
}
