import { useRef } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { clsx } from '../utils/format'

interface Props {
  volume: number
  onChange: (v: number) => void
  /** Track width in px. The bottom bar uses 80, the full player 96. */
  width?: number
  className?: string
}

/**
 * App-native volume control. Mirrors the seek bar (ProgressBar.tsx): a
 * div-based track with an accent-gradient fill and a glowing thumb that
 * fades in on hover — instead of the browser's default `input[type=range]`
 * chrome. Click-to-set, drag, and scroll-wheel all adjust the value; the
 * speaker icon toggles mute. Pure presentational: `onChange` drives the
 * store's `setVolume`, which owns MusicKit + persistence.
 */
export function VolumeSlider({ volume, onChange, width = 80, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const muted = volume === 0
  const Icon = muted ? VolumeX : volume < 0.35 ? Volume1 : Volume2
  const pct = Math.max(0, Math.min(100, volume * 100))
  // Restore to a sensible level when un-muting from zero.
  const lastNonZero = useRef(0.8)
  if (volume > 0) lastNonZero.current = volume

  const handleDown = (e: React.MouseEvent) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const compute = (clientX: number) =>
      Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onChange(compute(e.clientX))
    const onMove = (ev: MouseEvent) => onChange(compute(ev.clientX))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onWheel = (e: React.WheelEvent) => {
    const next = volume + (e.deltaY < 0 ? 0.05 : -0.05)
    onChange(Math.max(0, Math.min(1, Math.round(next * 100) / 100)))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(1, Math.round((volume + 0.05) * 100) / 100))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(0, Math.round((volume - 0.05) * 100) / 100))
    }
  }

  return (
    <div className={clsx('group/vol flex items-center gap-2', className)}>
      <button
        onClick={() => onChange(muted ? lastNonZero.current : 0)}
        className="text-obsidian-300 hover:text-white transition flex-shrink-0"
        title={muted ? 'Unmute (M)' : 'Mute (M)'}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        <Icon size={16} />
      </button>
      <div
        ref={trackRef}
        onMouseDown={handleDown}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        tabIndex={0}
        className="relative h-1 bg-white/[0.10] rounded-full cursor-pointer outline-none"
        style={{ width }}
      >
        <div
          className="absolute inset-y-0 left-0 accent-gradient rounded-full"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full accent-bg shadow-[0_0_10px_rgb(var(--accent)/0.6)] opacity-0 group-hover/vol:opacity-100 transition-opacity"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  )
}
