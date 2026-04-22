import { useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, X, Maximize2, Heart } from 'lucide-react'
import { usePlayer } from '../store/player'
import { artworkUrl, formatDuration, clsx } from '../utils/format'

/**
 * Apple Music-style portrait mini player. Discrete sections instead of a
 * full-bleed overlay (that reads iOS-card, not Windows/macOS MiniPlayer):
 *
 *   ┌─────────── drag strip ──────────┐
 *   │                                 │
 *   │        album artwork            │  ← padded square art
 *   │                                 │
 *   ├─────────────────────────────────┤
 *   │  Title                          │
 *   │  Artist                         │
 *   ├─────────────────────────────────┤
 *   │ 0:45 ▬▬▬●────────────────── 3:45│  ← scrubber
 *   │   ⏮    ▶/⏸    ⏭         ♡     │
 *   └─────────────────────────────────┘
 *
 * The mini player only renders UI; all transport commands round-trip to
 * the main window via `sync.broadcast`.
 */
export function MiniPlayer() {
  const np = usePlayer((s) => s.nowPlaying)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const progressMs = usePlayer((s) => s.progressMs)
  const durationMs = usePlayer((s) => s.durationMs)
  const likedIds = usePlayer((s) => s.likedIds)

  const liked = np ? !!likedIds[np.id] : false
  const art = artworkUrl(np?.artworkUrl, 600)
  const pct = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0

  const send = (type: string, extra: any = {}) =>
    window.bombo.sync.broadcast({ type, ...extra })

  const scrubberRef = useRef<HTMLDivElement>(null)
  const onScrub = (e: React.MouseEvent) => {
    if (!scrubberRef.current || durationMs <= 0) return
    const rect = scrubberRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    send('cmd:seek', { ms: Math.round(ratio * durationMs) })
  }

  return (
    <div className="relative w-screen h-screen bg-obsidian-950 text-obsidian-100 overflow-hidden select-none flex flex-col">
      {/* Drag strip (top 28px) with close + expand buttons */}
      <div className="drag-region relative h-7 flex items-center justify-end px-2 flex-shrink-0">
        <div className="no-drag flex gap-1">
          <WindowBtn onClick={() => window.bombo.miniPlayer.close()} title="Back to main window">
            <Maximize2 size={11} />
          </WindowBtn>
          <WindowBtn
            onClick={() => window.bombo.miniPlayer.close()}
            title="Close"
            danger
          >
            <X size={12} />
          </WindowBtn>
        </div>
      </div>

      {/* Artwork (square, padded) */}
      <div className="px-5 flex-shrink-0">
        <div
          className="w-full aspect-square rounded-lg overflow-hidden bg-obsidian-800 shadow-[0_18px_36px_-16px_rgba(0,0,0,0.7)]"
          style={{
            background: art ? undefined : 'linear-gradient(135deg,#1a1324,#0a0812)',
          }}
        >
          {art && (
            <img
              src={art}
              alt=""
              draggable={false}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="px-5 pt-4 flex-1 min-h-0 flex flex-col justify-end">
        <div className="truncate text-[14px] font-semibold tracking-tight text-cream">
          {np?.title ?? 'Nothing playing'}
        </div>
        <div className="truncate text-[12px] text-obsidian-300 mt-0.5">
          {np?.artistName ?? '—'}
        </div>

        {/* Scrubber + time */}
        <div className="mt-3">
          <div
            ref={scrubberRef}
            onClick={onScrub}
            className="h-1 rounded-full bg-white/[0.08] relative cursor-pointer group"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/80 group-hover:bg-white transition-colors"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10.5px] text-obsidian-400 font-mono tabular-nums mt-1">
            <span>{formatDuration(progressMs)}</span>
            <span>{formatDuration(durationMs)}</span>
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="px-5 pb-4 flex items-center justify-center gap-5 flex-shrink-0">
        <TransportBtn onClick={() => send('cmd:previous')} title="Previous">
          <SkipBack size={18} fill="currentColor" />
        </TransportBtn>
        <PrimaryBtn
          onClick={() => send('cmd:toggle')}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" className="translate-x-[1px]" />
          )}
        </PrimaryBtn>
        <TransportBtn onClick={() => send('cmd:next')} title="Next">
          <SkipForward size={18} fill="currentColor" />
        </TransportBtn>
        <TransportBtn
          onClick={() => {
            if (np) usePlayer.getState().toggleLike(np.id)
          }}
          title={liked ? 'Unlove' : 'Love'}
          active={liked}
          disabled={!np}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </TransportBtn>
      </div>
    </div>
  )
}

function PrimaryBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-11 h-11 rounded-full bg-cream text-obsidian-950 flex items-center justify-center shadow-[0_4px_18px_-4px_rgba(255,255,255,0.35)] hover:bg-white active:scale-95 transition"
    >
      {children}
    </button>
  )
}

function TransportBtn({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={clsx(
        'p-1.5 rounded-md transition',
        disabled && 'opacity-30 cursor-not-allowed',
        !disabled && active && 'accent-text',
        !disabled && !active && 'text-obsidian-200 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function WindowBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        'w-6 h-6 rounded flex items-center justify-center text-obsidian-300 transition',
        danger ? 'hover:bg-red-600/80 hover:text-white' : 'hover:bg-white/[0.08] hover:text-white',
      )}
    >
      {children}
    </button>
  )
}
