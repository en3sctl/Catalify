import { useEffect, useMemo, useRef } from 'react'
import { usePlayer } from '../store/player'
import { formatDuration } from '../utils/format'

/**
 * Synthesised waveform progress bar.
 *
 * Apple Music's streams are locked behind Widevine DRM so we can't pipe
 * them through an AudioContext analyser for a real waveform. Instead we
 * generate a deterministic "fake" envelope seeded by the track id — same
 * song gives the same wave every time, different songs get different
 * shapes — and paint progress on top with the accent colour.
 *
 * Performance: previously this redrew the canvas every rAF tick (~60 fps
 * × ~110 bars), saturating the main thread and freezing the UI after a
 * few minutes. It now redraws ONLY when the read-head crosses a bar
 * boundary (roughly once per 1-2 s in a typical song), so CPU drops from
 * "constantly burning" to "effectively idle".
 */
export function Waveform({ bars = 110 }: { bars?: number }) {
  const np = usePlayer((s) => s.nowPlaying)
  const progressMs = usePlayer((s) => s.progressMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const seek = usePlayer((s) => s.seek)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const heights = useMemo(() => synthesizeWave(np?.id ?? 'idle', bars), [np?.id, bars])

  // Bar the read-head currently sits in. When this doesn't change, we
  // skip the entire canvas redraw — that's the whole CPU win.
  const playedBar =
    durationMs > 0 ? Math.floor((progressMs / durationMs) * heights.length) : -1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Hoisted draw — runs both on dependency change AND on container
    // resize. Without the resize hook the canvas stayed sized to its
    // pre-lyrics width, so the playhead drifted out of sync visually
    // every time the user toggled the side lyrics panel.
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = window.devicePixelRatio || 1
      const needsResize =
        canvas.width !== Math.floor(rect.width * dpr) ||
        canvas.height !== Math.floor(rect.height * dpr)
      if (needsResize) {
        canvas.width = Math.floor(rect.width * dpr)
        canvas.height = Math.floor(rect.height * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const W = rect.width
      const H = rect.height
      ctx.clearRect(0, 0, W, H)

      // Pick how many bars actually fit. The full envelope has
      // `heights.length` entries; in narrow layouts (lyrics-open mode
      // halves the cover column) we render a downsampled subset so
      // bars don't overflow the canvas — that overflow was making the
      // played fill look ~75% complete when the song was actually 93%
      // through, since the would-be-filled bars were clipped offscreen.
      const minBarPx = 3 // bar + gap
      const maxBars = Math.max(20, Math.floor(W / minBarPx))
      const barCount = Math.min(heights.length, maxBars)
      const gap = 2
      const barW = Math.max(1, (W - (barCount - 1) * gap) / barCount)
      const playedRatio = durationMs > 0 ? progressMs / durationMs : 0
      const visiblePlayedBar = Math.floor(playedRatio * barCount)
      // Played bars use bright white, not the album-art accent. On
      // covers with warm tones the accent sits close to the ambient
      // backdrop and the fill became invisible. Bumped unplayed alpha
      // from 0.14 to 0.22 so the played→unplayed boundary doesn't
      // visually swallow the bar immediately before the playhead.
      const playedColor = 'rgba(255,255,255,0.95)'
      const unplayedColor = 'rgba(255,255,255,0.22)'
      const edgeColor = 'rgba(255,255,255,1)'

      for (let i = 0; i < barCount; i++) {
        // Resample the deterministic envelope so the wave shape stays
        // recognisable regardless of how many bars we draw.
        const srcIdx =
          barCount === heights.length
            ? i
            : Math.min(
                heights.length - 1,
                Math.floor((i / Math.max(1, barCount - 1)) * (heights.length - 1)),
              )
        const h = Math.max(2, heights[srcIdx] * H * 0.85)
        // Pixel-snap to a 1px grid so adjacent bars never lose a sliver
        // to sub-pixel rounding (was making single bars look "missing"
        // in narrow lyrics-open layouts).
        const x = Math.round(i * (barW + gap))
        const w = Math.max(1, Math.round(barW))
        const y = Math.round((H - h) / 2)
        const rh = Math.max(2, Math.round(h))
        ctx.fillStyle =
          i < visiblePlayedBar
            ? playedColor
            : i === visiblePlayedBar
              ? edgeColor
              : unplayedColor
        roundRect(ctx, x, y, w, rh, w * 0.5)
        ctx.fill()
      }
    }
    draw()

    // Watch the canvas's parent for layout changes (lyrics open/close
    // shrinks the cover column over a 420ms transition; without this
    // the bars stayed at their old width until the next progress tick).
    const observer = new ResizeObserver(() => draw())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [heights, playedBar, durationMs])

  const handleClick = (e: React.MouseEvent) => {
    if (durationMs <= 0) return
    const target = wrapperRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(Math.round(ratio * durationMs))
  }

  // Continuous play-head position for the overlay line (not tied to bar
  // boundaries). CSS transitions smooth out the 150 ms store ticks into
  // visually continuous motion without hammering canvas redraws.
  const playheadPct =
    durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="w-10 text-right text-[11px] text-obsidian-300 font-mono tabular-nums">
        {formatDuration(progressMs)}
      </span>
      <div
        ref={wrapperRef}
        onClick={handleClick}
        // `overflow-hidden` clips the playhead's soft glow so it can't
        // bleed into the transport-button row directly beneath the bar.
        // Previously the 10 px white box-shadow travelled with the read
        // head and visibly "filled" the buttons as the song advanced.
        className="flex-1 h-9 cursor-pointer relative overflow-hidden"
        role="slider"
        aria-label="Seek"
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0"
          style={{
            left: `${playheadPct}%`,
            transform: 'translateX(-50%)',
            transition: 'left 170ms linear',
          }}
        >
          <div
            className="w-[2px] h-full rounded-full"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              // Smaller, horizontal-only glow. No vertical bleed means
              // the buttons below stay clean as the head travels.
              boxShadow: '0 0 6px rgba(255, 255, 255, 0.45)',
            }}
          />
        </div>
      </div>
      <span className="w-10 text-[11px] text-obsidian-300 font-mono tabular-nums">
        {formatDuration(durationMs)}
      </span>
    </div>
  )
}

/* ── Deterministic wave synthesis ───────────────────────────── */

function synthesizeWave(seed: string, count: number): number[] {
  const rnd = mulberry32(hashString(seed))
  const out = new Array<number>(count)
  const phase1 = rnd() * Math.PI * 2
  const phase2 = rnd() * Math.PI * 2
  const phase3 = rnd() * Math.PI * 2
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const carrier =
      Math.sin(t * Math.PI * 4 + phase1) * 0.22 +
      Math.sin(t * Math.PI * 9 + phase2) * 0.12 +
      Math.sin(t * Math.PI * 17 + phase3) * 0.06
    const noise = rnd() * 0.35
    const envelope = Math.min(1, t * 3) * Math.min(1, (1 - t) * 3 + 0.2)
    const raw = 0.45 + carrier + noise
    out[i] = Math.max(0.12, Math.min(1, raw * envelope))
  }
  return out
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h || 1
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}
