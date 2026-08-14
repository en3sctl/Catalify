import { useEffect } from 'react'
import { extractDominantColor, normalizeAccent, rgbToCssTriplet, softenColor } from '../utils/color-extract'
import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'

// Fixed accents for the static themes. The light pair is deliberately
// darker — accent-as-text has to clear contrast on paper surfaces.
const DARK_ACCENT = { accent: '255 170 95', soft: '240 150 80' }
const LIGHT_ACCENT = { accent: '186 106 38', soft: '150 88 36' }

/**
 * Watches now-playing artwork and updates CSS custom properties `--accent`
 * and `--accent-soft` so the whole UI picks up color from the album art.
 * Only the adaptive theme extracts from artwork — dark/light pin a fixed
 * accent instead.
 */
export function useArtColors() {
  const art = usePlayer((s) => s.nowPlaying?.artworkUrl)
  const theme = useSettings((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme !== 'adaptive') {
      const { accent, soft } = theme === 'light' ? LIGHT_ACCENT : DARK_ACCENT
      root.style.setProperty('--accent', accent)
      root.style.setProperty('--accent-soft', soft)
      return
    }
    if (!art) return
    let cancelled = false
    extractDominantColor(art).then((raw) => {
      if (cancelled) return
      // Clamp into the readable band — raw dominant colors from dark
      // covers can be near-black, which made accent text/pills vanish.
      const rgb = normalizeAccent(raw)
      root.style.setProperty('--accent', rgbToCssTriplet(rgb))
      root.style.setProperty('--accent-soft', rgbToCssTriplet(softenColor(rgb, 0.6)))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [art, theme])
}
