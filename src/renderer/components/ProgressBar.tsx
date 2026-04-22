import { useRef, useState } from 'react'
import { usePlayer } from '../store/player'
import { formatDuration } from '../utils/format'

export function ProgressBar() {
  const progressMs = usePlayer((s) => s.progressMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const seek = usePlayer((s) => s.seek)

  const trackRef = useRef<HTMLDivElement>(null)
  const [hovering, setHovering] = useState(false)
  const [dragMs, setDragMs] = useState<number | null>(null)

  const shownMs = dragMs ?? progressMs
  const pct = durationMs > 0 ? Math.min(100, (shownMs / durationMs) * 100) : 0

  const handleDown = (e: React.MouseEvent) => {
    const track = trackRef.current
    if (!track || durationMs === 0) return
    const rect = track.getBoundingClientRect()
    const compute = (clientX: number) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return ratio * durationMs
    }
    setDragMs(compute(e.clientX))
    const onMove = (ev: MouseEvent) => setDragMs(compute(ev.clientX))
    const onUp = (ev: MouseEvent) => {
      const finalMs = compute(ev.clientX)
      setDragMs(null)
      seek(finalMs)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex items-center gap-2 w-full text-[11px] text-obsidian-300 tabular-nums">
      <span className="w-10 text-right">{formatDuration(shownMs)}</span>
      <div
        ref={trackRef}
        className="flex-1 h-1 bg-white/[0.06] rounded-full cursor-pointer relative group"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseDown={handleDown}
      >
        <div
          className="absolute inset-y-0 left-0 accent-gradient rounded-full"
          style={{ width: `${pct}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full accent-bg shadow-[0_0_10px_rgb(var(--accent)/0.6)] transition-opacity ${
            hovering || dragMs !== null ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <span className="w-10">{formatDuration(durationMs)}</span>
    </div>
  )
}
