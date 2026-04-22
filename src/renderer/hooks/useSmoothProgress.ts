import { useEffect, useRef, useState } from 'react'

/**
 * Extrapolate between the store's 150 ms progress ticks with requestAnimationFrame
 * so karaoke fills, progress bars and scrubbers glide at display refresh rate.
 * Pause instantly freezes the extrapolation — we don't want the head to keep
 * advancing when the user pauses.
 *
 * Throttled to ~25 fps (40 ms) instead of the display's full 60 fps: that's
 * enough for smooth-looking per-word fills while cutting downstream React
 * re-renders (LyricsPanel's `WordToken` changes inline `color` per frame,
 * which otherwise compounds with Waveform and Discord pushes to saturate
 * the main thread and freeze the UI after a few minutes of playback).
 */
export function useSmoothProgress(basisMs: number, isPlaying: boolean): number {
  const [value, setValue] = useState(basisMs)
  const snapshotAt = useRef(performance.now())
  const snapshotBasis = useRef(basisMs)

  useEffect(() => {
    snapshotAt.current = performance.now()
    snapshotBasis.current = basisMs
    setValue(basisMs)
  }, [basisMs])

  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let lastEmitted = 0
    const MIN_INTERVAL_MS = 40
    const tick = () => {
      const now = performance.now()
      if (now - lastEmitted >= MIN_INTERVAL_MS) {
        lastEmitted = now
        const elapsed = now - snapshotAt.current
        setValue(snapshotBasis.current + elapsed)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  return value
}
