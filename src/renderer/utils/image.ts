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

/**
 * Square-crop + shrink an existing data URL to a tiny JPEG (for syncing the
 * profile avatar to the social backend, which stores it as text in D1 — so
 * it must stay small, ~3-6 KB at 96px).
 */
export async function shrinkDataUrl(dataUrl: string, max: number): Promise<string> {
  const img = document.createElement('img')
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
  const side = Math.min(img.naturalWidth, img.naturalHeight) || max
  const sx = Math.round((img.naturalWidth - side) / 2)
  const sy = Math.round((img.naturalHeight - side) / 2)
  const w = Math.min(max, side)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = w
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.drawImage(img, sx, sy, side, side, 0, 0, w, w)
  return canvas.toDataURL('image/jpeg', 0.7)
}
