import { useEffect } from 'react'
import { extractDominantColor, rgbToCssTriplet, softenColor } from '../utils/color-extract'
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
    extractDominantColor(art).then((rgb) => {
      if (cancelled) return
      const root = document.documentElement
      root.style.setProperty('--accent', rgbToCssTriplet(rgb))
      root.style.setProperty('--accent-soft', rgbToCssTriplet(softenColor(rgb, 0.6)))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [art])
}
