/**
 * Lightweight dominant-color extraction from an image URL.
 * Returns an { r, g, b } object sampled from a small canvas thumbnail.
 * Filters out near-black and near-white pixels to get a "vibrant" color.
 */
export interface RGB {
  r: number
  g: number
  b: number
}

const cache = new Map<string, RGB>()

export async function extractDominantColor(url: string): Promise<RGB> {
  const cached = cache.get(url)
  if (cached) return cached

  return new Promise<RGB>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 48
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('canvas 2d unavailable')
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        // Bucket by rounded hue-ish buckets, track count + saturation
        const buckets = new Map<string, { r: number; g: number; b: number; count: number; sat: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          if (a < 200) continue
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const lum = (max + min) / 2
          if (lum < 30 || lum > 230) continue // filter very dark/light
          const sat = max === 0 ? 0 : (max - min) / max
          if (sat < 0.18) continue // filter grays
          const key = `${r >> 4}-${g >> 4}-${b >> 4}`
          const bucket = buckets.get(key)
          if (bucket) {
            bucket.r += r
            bucket.g += g
            bucket.b += b
            bucket.count += 1
            bucket.sat += sat
          } else {
            buckets.set(key, { r, g, b, count: 1, sat })
          }
        }

        if (buckets.size === 0) {
          const fallback = { r: 180, g: 220, b: 255 }
          cache.set(url, fallback)
          resolve(fallback)
          return
        }

        // Score = count * (1 + saturation weight)
        let best: { r: number; g: number; b: number; count: number; sat: number } | null = null
        let bestScore = -1
        for (const bucket of buckets.values()) {
          const avgSat = bucket.sat / bucket.count
          const score = bucket.count * (1 + avgSat * 1.5)
          if (score > bestScore) {
            bestScore = score
            best = bucket
          }
        }
        const chosen: RGB = best
          ? {
              r: Math.round(best.r / best.count),
              g: Math.round(best.g / best.count),
              b: Math.round(best.b / best.count),
            }
          : { r: 180, g: 220, b: 255 }
        cache.set(url, chosen)
        resolve(chosen)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

/** Lighten/darken for readability — returns `r g b` string. */
export function rgbToCssTriplet(c: RGB): string {
  return `${c.r} ${c.g} ${c.b}`
}

export function softenColor(c: RGB, factor = 0.55): RGB {
  return {
    r: Math.round(c.r * factor + 255 * (1 - factor) * 0.3),
    g: Math.round(c.g * factor + 255 * (1 - factor) * 0.3),
    b: Math.round(c.b * factor + 255 * (1 - factor) * 0.3),
  }
}
