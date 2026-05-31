/**
 * Read a user-picked image file and return a JPEG data URL no larger than
 * `max` px per side. Keeps electron-store payloads small (a few hundred KB
 * at most) even if the user picks a 4K source.
 *
 * When `square` is true the image is centre-cropped to a square before
 * scaling — used for playlist covers, which render in a square frame. When
 * false the aspect ratio is preserved (used for the round profile avatar).
 */
export async function resizeImageToDataUrl(
  file: File,
  max: number,
  square = false,
): Promise<string> {
  const bitmap = await createImageBitmap(file)
  let sx = 0
  let sy = 0
  let sw = bitmap.width
  let sh = bitmap.height
  if (square) {
    const side = Math.min(bitmap.width, bitmap.height)
    sx = Math.round((bitmap.width - side) / 2)
    sy = Math.round((bitmap.height - side) / 2)
    sw = side
    sh = side
  }
  const ratio = Math.min(max / sw, max / sh, 1)
  const w = Math.max(1, Math.round(sw * ratio))
  const h = Math.max(1, Math.round(sh * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}
