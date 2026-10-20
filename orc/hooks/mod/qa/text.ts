import type { Els } from '../pane'
import type { QaShot } from './model'
import { halfBlocks, RASTER_COLUMNS, RASTER_ROWS } from './raster'

export type QaMode = 'image' | 'raster'

// Terminal thumbnails: pixels (Image) where the terminal draws them, half-blocks (Raster) otherwise,
// the file path when there is no jpg/rgb to draw.
export function qaThumbsText(els: Els, shots: QaShot[], mode: QaMode) {
  const Image = 'Image' in els ? els.Image : null
  const Raster = 'Raster' in els ? els.Raster : null
  return shots.map(s => {
    const cells = s.rgb ? halfBlocks(s.rgb) : null
    const pic = mode === 'image' && Image && s.png
      ? Image({ key: 'qa-img-' + s.name, source: { file: s.png, format: 'png' }, columns: 14, rows: 6, alt: s.criterion || s.name })
      : Raster && cells
        ? Raster({ key: 'qa-ras-' + s.name, columns: RASTER_COLUMNS, rows: RASTER_ROWS, cells })
        : null
    const caption = els.Text({ dimColor: true, children: [(s.criterion || s.name) + (pic ? '' : s.png ? '  ' + s.png : '')] })
    return pic ? els.Box({ flexDirection: 'column', children: [pic, caption] }) : caption
  })
}
