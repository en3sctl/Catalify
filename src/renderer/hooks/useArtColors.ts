import { useEffect } from 'react'
import { extractDominantColor, normalizeAccent, rgbToCssTriplet, softenColor } from '../utils/color-extract'
import { usePlayer } from '../store/player'

/**
 * Watches now-playing artwork and updates CSS custom properties `--accent`
 * and `--accent-soft` so the whole UI picks up color from the album art.
 */
export function useArtColors() {
  const art = usePlayer((s) => s.nowPlaying?.artworkUrl)

  useEffect(() => {
    if (!art) return
    let cancelled = false
    extractDominantColor(art).then((raw) => {
      if (cancelled) return
      // Clamp into the readable band — raw dominant colors from dark
      // covers can be near-black, which made accent text/pills vanish.
      const rgb = normalizeAccent(raw)
      const root = document.documentElement
      root.style.setProperty('--accent', rgbToCssTriplet(rgb))
      root.style.setProperty('--accent-soft', rgbToCssTriplet(softenColor(rgb, 0.6)))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [art])
}
