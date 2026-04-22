/**
 * Windows thumbnail-toolbar buttons (the prev/play/next mini-controls
 * that appear when the taskbar preview pops up) require actual raster
 * bitmaps. Electron's `nativeImage.createFromDataURL` with SVG renders as
 * 0×0 on Windows and the buttons show up blank. We work around it by
 * drawing simple white glyphs to a canvas in the renderer and sending the
 * resulting PNG data-URLs through IPC to main. Computed once, memoised.
 */

export interface ThumbarIcons {
  prev: string
  next: string
  play: string
  pause: string
}

let cache: ThumbarIcons | null = null

export function getThumbarIcons(): ThumbarIcons {
  if (cache) return cache
  cache = {
    prev: drawIcon((ctx) => {
      // Left bar + left-pointing triangle
      ctx.fillRect(6, 8, 4, 16)
      ctx.beginPath()
      ctx.moveTo(26, 8)
      ctx.lineTo(12, 16)
      ctx.lineTo(26, 24)
      ctx.closePath()
      ctx.fill()
    }),
    next: drawIcon((ctx) => {
      // Right bar + right-pointing triangle
      ctx.fillRect(22, 8, 4, 16)
      ctx.beginPath()
      ctx.moveTo(6, 8)
      ctx.lineTo(20, 16)
      ctx.lineTo(6, 24)
      ctx.closePath()
      ctx.fill()
    }),
    play: drawIcon((ctx) => {
      ctx.beginPath()
      ctx.moveTo(10, 7)
      ctx.lineTo(25, 16)
      ctx.lineTo(10, 25)
      ctx.closePath()
      ctx.fill()
    }),
    pause: drawIcon((ctx) => {
      ctx.fillRect(9, 8, 5, 16)
      ctx.fillRect(18, 8, 5, 16)
    }),
  }
  return cache
}

function drawIcon(paint: (ctx: CanvasRenderingContext2D) => void): string {
  // 32×32 because Windows scales thumbar icons up to 32px on HiDPI
  // taskbars; drawing at 16 and letting Windows upscale looks blurry.
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  paint(ctx)
  return canvas.toDataURL('image/png')
}
