import { useRef, useState } from 'react'
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
 *
 * The visible track is 4px tall but the interactive surface is a 20px-tall
 * strip around it — the thin bar was genuinely hard to grab. Dragging uses
 * pointer capture so the thumb keeps following even when the cursor leaves
 * the strip mid-drag.
 */
export function VolumeSlider({ volume, onChange, width = 80, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const muted = volume === 0
  const Icon = muted ? VolumeX : volume < 0.35 ? Volume1 : Volume2
  const pct = Math.max(0, Math.min(100, volume * 100))
  // Restore to a sensible level when un-muting from zero.
  const lastNonZero = useRef(0.8)
  if (volume > 0) lastNonZero.current = volume

  const computeFromX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return volume
    const rect = track.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    onChange(computeFromX(e.clientX))
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    onChange(computeFromX(e.clientX))
  }
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return
    setDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
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
      {/* Hit area: full-height touch strip; the visible 4px track sits centred inside it. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        tabIndex={0}
        className="relative h-5 flex items-center cursor-pointer outline-none touch-none select-none"
        style={{ width }}
      >
        <div
          ref={trackRef}
          className={clsx(
            'relative w-full bg-white/[0.10] rounded-full transition-[height] duration-150',
            dragging ? 'h-[6px]' : 'h-1 group-hover/vol:h-[6px]',
          )}
        >
          <div
            className="absolute inset-y-0 left-0 accent-gradient rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full accent-bg shadow-[0_0_10px_rgb(var(--accent)/0.6)] transition-opacity pointer-events-none',
            dragging ? 'opacity-100' : 'opacity-0 group-hover/vol:opacity-100',
          )}
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  )
}
