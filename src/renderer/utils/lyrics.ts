import { getMusicKit } from './musickit-api'

export interface LyricLine {
  timeMs: number
  text: string
}

export interface LyricsResult {
  lines: LyricLine[]
  synced: boolean
  source: 'lrclib' | 'apple'
}

export interface LyricsQuery {
  title: string
  artistName: string
  albumName?: string
  durationMs?: number
  appleSongId?: string
}

const LRCLIB_UA = 'Catalify/0.1.0 (https://github.com/enes/catalify)'

/**
 * Try lrclib.net first (open, free, well-synced). If no match, fall back to
 * Apple Music's TTML endpoints (usually only works for full subscribers on
 * catalog tracks, often returns nothing).
 */
export async function fetchLyrics(q: LyricsQuery): Promise<LyricsResult | null> {
  const lrcResult = await fetchFromLrclib(q)
  if (lrcResult) return lrcResult
  if (q.appleSongId) {
    const apple = await fetchFromApple(q.appleSongId)
    if (apple) return apple
  }
  return null
}

async function fetchFromLrclib(q: LyricsQuery): Promise<LyricsResult | null> {
  try {
    // Exact match endpoint — fastest path, returns a single best match
    const params = new URLSearchParams({
      track_name: q.title,
      artist_name: q.artistName,
    })
    if (q.albumName) params.set('album_name', q.albumName)
    if (q.durationMs && q.durationMs > 0) {
      params.set('duration', String(Math.round(q.durationMs / 1000)))
    }
    const exact = await lrclibFetch(`/api/get?${params.toString()}`)
    if (exact) {
      const parsed = parseLrclibItem(exact)
      if (parsed) return parsed
    }

    // Fallback: search endpoint for near matches when duration differs or
    // the metadata isn't a perfect match (live versions, remasters, etc.)
    const searchParams = new URLSearchParams({
      track_name: q.title,
      artist_name: q.artistName,
    })
    const results = await lrclibFetch(`/api/search?${searchParams.toString()}`)
    if (Array.isArray(results) && results.length > 0) {
      const best = pickBestMatch(results, q)
      const parsed = parseLrclibItem(best)
      if (parsed) return parsed
    }
    return null
  } catch {
    return null
  }
}

async function lrclibFetch(path: string): Promise<any> {
  const res = await fetch(`https://lrclib.net${path}`, {
    headers: { 'User-Agent': LRCLIB_UA },
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

interface LrclibItem {
  id: number
  plainLyrics: string | null
  syncedLyrics: string | null
  duration: number | null
  instrumental?: boolean
}

function pickBestMatch(items: LrclibItem[], q: LyricsQuery): LrclibItem {
  if (!q.durationMs || q.durationMs <= 0) return items[0]
  const targetSec = q.durationMs / 1000
  // Prefer synced + closest duration
  let best = items[0]
  let bestScore = scoreMatch(items[0], targetSec)
  for (let i = 1; i < items.length; i++) {
    const s = scoreMatch(items[i], targetSec)
    if (s > bestScore) {
      best = items[i]
      bestScore = s
    }
  }
  return best
}

function scoreMatch(item: LrclibItem, targetSec: number): number {
  let score = 0
  if (item.syncedLyrics) score += 100
  if (item.duration && Math.abs(item.duration - targetSec) <= 2) score += 50
  else if (item.duration) score -= Math.min(40, Math.abs(item.duration - targetSec))
  if (item.instrumental) score -= 200
  return score
}

function parseLrclibItem(item: LrclibItem | null): LyricsResult | null {
  if (!item) return null
  if (item.instrumental) {
    return { lines: [{ timeMs: 0, text: '♪ Instrumental ♪' }], synced: false, source: 'lrclib' }
  }
  if (item.syncedLyrics && item.syncedLyrics.trim().length > 0) {
    const lines = parseLRC(item.syncedLyrics)
    if (lines.length > 0) return { lines, synced: true, source: 'lrclib' }
  }
  if (item.plainLyrics && item.plainLyrics.trim().length > 0) {
    const lines = item.plainLyrics
      .split('\n')
      .map((t) => ({ timeMs: 0, text: t.trim() }))
      .filter((l) => l.text.length > 0)
    if (lines.length > 0) return { lines, synced: false, source: 'lrclib' }
  }
  return null
}

/**
 * Parse LRC-format lyrics: lines prefixed with one or more timestamps like
 * `[mm:ss.xx]`. A single line may carry multiple timestamps (when the same
 * text repeats in the song); we emit one entry per timestamp so the active
 * line tracking highlights every occurrence.
 */
export function parseLRC(lrc: string): LyricLine[] {
  const out: LyricLine[] = []
  const rows = lrc.split(/\r?\n/)
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g
  for (const row of rows) {
    const stamps: number[] = []
    let match: RegExpExecArray | null
    let lastEnd = 0
    tagRegex.lastIndex = 0
    while ((match = tagRegex.exec(row)) !== null) {
      const mm = parseInt(match[1], 10)
      const ss = parseInt(match[2], 10)
      const fracRaw = match[3] ?? '0'
      const frac = parseFloat(`0.${fracRaw.padEnd(3, '0').slice(0, 3)}`)
      stamps.push(Math.round((mm * 60 + ss + frac) * 1000))
      lastEnd = match.index + match[0].length
    }
    if (stamps.length === 0) continue
    const text = row.slice(lastEnd).trim()
    if (!text) continue
    for (const t of stamps) out.push({ timeMs: t, text })
  }
  out.sort((a, b) => a.timeMs - b.timeMs)
  return out
}

async function fetchFromApple(songId: string): Promise<LyricsResult | null> {
  try {
    const mk = getMusicKit()
    const sf = mk.storefrontId || 'us'
    for (const path of [
      `/v1/catalog/${sf}/songs/${songId}/syllable-lyrics`,
      `/v1/catalog/${sf}/songs/${songId}/lyrics`,
    ]) {
      try {
        const res = await mk.api.music(path)
        const doc = res.data?.data?.[0]?.attributes?.ttml
        if (doc) {
          const lines = parseTTML(doc)
          if (lines.length > 0) {
            const synced = lines.some((l) => l.timeMs > 0)
            return { lines, synced, source: 'apple' }
          }
        }
      } catch {}
    }
    return null
  } catch {
    return null
  }
}

function parseTTML(ttml: string): LyricLine[] {
  try {
    const parser = new DOMParser()
    const dom = parser.parseFromString(ttml, 'application/xml')
    const ps = Array.from(dom.getElementsByTagName('p'))
    const lines: LyricLine[] = []
    for (const p of ps) {
      const text = (p.textContent || '').trim()
      if (!text) continue
      const begin = p.getAttribute('begin') || '0s'
      lines.push({ timeMs: parseTTMLTime(begin), text })
    }
    return lines
  } catch {
    return []
  }
}

function parseTTMLTime(v: string): number {
  if (/^[\d.]+s$/.test(v)) return Math.round(parseFloat(v) * 1000)
  const parts = v.split(':').map(parseFloat)
  if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000)
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000)
  return 0
}
