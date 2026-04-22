import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Mic2,
  ListMusic,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Volume1,
} from 'lucide-react'
import { usePlayer } from '../store/player'
import { Waveform } from '../components/Waveform'
import { LyricsPanel } from '../components/LyricsPanel'
import { QueueDrawer } from '../components/QueueDrawer'
import { artworkUrl, clsx } from '../utils/format'

/**
 * Apple Music-style immersive Now Playing view. Giant blurred album art
 * fills the window as an ambient backdrop ("liquid glass" surfaces float on
 * top). Layout collapses into a split view when Lyrics is toggled on.
 *
 *   ┌─ full panel ─────────────────────────────────────────┐
 *   │ [blurred art + dark gradient]                         │
 *   │  ⌄ close                      🎤 lyrics   ≡ queue    │
 *   │  ╔══════════════════════╗  ╔══════════════════════╗  │
 *   │  ║ cover + meta +       ║  ║ lyrics panel (side)  ║  │
 *   │  ║ scrubber + transport ║  ║ only when toggled on ║  │
 *   │  ╚══════════════════════╝  ╚══════════════════════╝  │
 *   └───────────────────────────────────────────────────────┘
 *
 * Esc / chevron returns to the previous route. The lyrics panel re-uses
 * the same `LyricsPanel` the standalone /lyrics route renders, so we get
 * karaoke scrolling for free.
 */
export function NowPlaying() {
  const navigate = useNavigate()
  const np = usePlayer((s) => s.nowPlaying)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const previous = usePlayer((s) => s.previous)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const cycleRepeat = usePlayer((s) => s.cycleRepeat)
  const likedIds = usePlayer((s) => s.likedIds)
  const toggleLike = usePlayer((s) => s.toggleLike)
  const volume = usePlayer((s) => s.volume)
  const setVolume = usePlayer((s) => s.setVolume)

  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)

  // Poll the Electron main process for fullscreen state — we don't have a
  // dedicated "fullscreen-changed" event wired up, and polling every
  // 800 ms is invisible perf-wise.
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const v = await window.bombo.window.isFullScreen()
        if (!cancelled) setIsFullScreen(!!v)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 800)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const toggleFullScreen = () => window.bombo.window.toggleFullScreen()

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Escape') {
        // Escape cascades: fullscreen → lyrics → close
        if (isFullScreen) {
          toggleFullScreen()
        } else if (lyricsOpen) {
          setLyricsOpen(false)
        } else {
          goBack()
        }
      } else if (e.key === 'F11') {
        e.preventDefault()
        toggleFullScreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lyricsOpen, isFullScreen])

  if (!np) {
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        <BackButton onClick={goBack} />
        <div className="text-obsidian-400 italic">Nothing playing right now.</div>
      </div>
    )
  }

  const liked = !!likedIds[np.id]
  const bigArt = artworkUrl(np.artworkUrl, 1000)
  const smallBlurArt = artworkUrl(np.artworkUrl, 200)

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ── Liquid-glass backdrop ──
          The key to Apple Music's "now playing" look is a huge, heavily
          blurred album-art wash behind everything else, tinted dark so
          translucent panels stay readable. We use the 200 px artwork
          variant here — blur destroys detail anyway and it's way cheaper
          than blurring the 1000 px one at full-window size. */}
      {smallBlurArt && (
        <>
          <img
            src={smallBlurArt}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scale(1.4)', filter: 'blur(56px) saturate(160%)' }}
          />
          <img
            src={smallBlurArt}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute -top-1/4 -right-1/4 w-[70%] h-[70%] object-cover opacity-70"
            style={{ transform: 'scale(1.2)', filter: 'blur(88px) saturate(180%)' }}
          />
        </>
      )}
      {/* Depth: vertical and radial darkening so content pops */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 70%), linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* ── Top toolbar (glass chips) ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
        <BackButton onClick={goBack} />
        <div className="flex items-center gap-1">
          <ToolChip
            active={lyricsOpen}
            onClick={() => setLyricsOpen((v) => !v)}
            title="Lyrics"
          >
            <Mic2 size={15} />
            <span className="text-[12px] tracking-tight">Lyrics</span>
          </ToolChip>
          <ToolChip
            active={queueOpen}
            onClick={() => setQueueOpen(true)}
            title="Up Next"
          >
            <ListMusic size={15} />
            <span className="text-[12px] tracking-tight">Queue</span>
          </ToolChip>
          <ToolChip
            active={isFullScreen}
            onClick={toggleFullScreen}
            title={isFullScreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (F11)'}
          >
            {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </ToolChip>
        </div>
      </div>

      {/* ── Main content ──
          When the lyrics side panel is open we switch to `items-stretch`
          so both columns fill the available height and the lyrics panel
          scrolls WITHIN ITSELF — otherwise the whole row scrolls and the
          left column's cover / transport controls get dragged out of
          view as the user scrubs lyrics. The side panel stretches all
          the way to the bottom edge (no pb) so there's no gap between
          its rounded bottom and the window edge — that gap used to read
          as a "footer bar" on top of the backdrop when lyrics advanced. */}
      <div
        className={clsx(
          'absolute inset-0 z-10 pt-14 px-8 flex justify-center gap-[min(6vw,48px)]',
          lyricsOpen
            ? 'items-stretch overflow-hidden pb-4'
            : 'items-center overflow-y-auto pb-6',
        )}
      >
        {/* Cover + meta + controls column */}
        <div
          className={clsx(
            'flex flex-col items-center min-w-0',
            lyricsOpen ? 'justify-center flex-[0.9] max-w-md' : 'max-w-2xl w-full',
          )}
          style={{
            gap: 'clamp(10px, 1.6vh, 18px)',
            transition: 'max-width 420ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <motion.div
            layoutId="np-hero-cover"
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex-shrink-0 aspect-square rounded-2xl overflow-hidden"
            style={{
              // `min(vh, vw)` keeps the cover a comfortable size on both
              // short/wide (ultrawide) and narrow/tall windows without ever
              // exceeding the numeric cap on huge displays.
              width: lyricsOpen
                ? 'min(clamp(180px, 32vh, 300px), 38vw)'
                : 'min(clamp(220px, 44vh, 420px), 50vw)',
              transition: 'width 420ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {bigArt ? (
              <img
                src={bigArt}
                alt={np.title}
                draggable={false}
                className="w-full h-full object-cover rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.85)]"
              />
            ) : (
              <div className="w-full h-full rounded-2xl bg-obsidian-800" />
            )}
            {/* Soft top highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            />
          </motion.div>

          {/* Meta */}
          <div className="text-center max-w-full min-w-0 px-2">
            <h1
              className="font-display font-bold tracking-tight leading-[1.05] selectable truncate"
              style={{
                fontSize: lyricsOpen
                  ? 'clamp(20px, 2.6vh, 30px)'
                  : 'clamp(28px, 4.6vh, 56px)',
                transition: 'font-size 420ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {np.title}
            </h1>
            <div
              className="mt-1 text-white/75 selectable truncate"
              style={{
                fontSize: lyricsOpen ? 'clamp(12px, 1.6vh, 14px)' : 'clamp(14px, 1.8vh, 18px)',
                transition: 'font-size 420ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {np.artistName}
            </div>
            {np.albumName && !lyricsOpen && (
              <div className="mt-0.5 text-white/40 text-[13px] selectable truncate">
                {np.albumName}
              </div>
            )}
          </div>

          <div className="w-full max-w-xl">
            <Waveform />
          </div>

          {/* Transport — glass chiclets with primary centerpiece */}
          <div className="flex items-center gap-[min(2vw,18px)]">
            <GlassBtn
              onClick={toggleShuffle}
              active={shuffle}
              title="Shuffle"
              small
            >
              <Shuffle size={16} />
            </GlassBtn>
            <GlassBtn onClick={previous} title="Previous">
              <SkipBack size={20} fill="currentColor" />
            </GlassBtn>
            <PlayBtn onClick={toggle} playing={isPlaying} />
            <GlassBtn onClick={next} title="Next">
              <SkipForward size={20} fill="currentColor" />
            </GlassBtn>
            <GlassBtn
              onClick={cycleRepeat}
              active={repeat !== 'none'}
              title={`Repeat: ${repeat}`}
              small
            >
              {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </GlassBtn>
          </div>

          {/* Love pill */}
          <button
            onClick={() => toggleLike(np.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] tracking-wide transition border',
              liked
                ? 'accent-text bg-white/[0.07] border-white/[0.14] backdrop-blur-xl'
                : 'text-white/70 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:text-white backdrop-blur-xl',
            )}
          >
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            {liked ? 'In your Library' : 'Add to Library'}
          </button>

          {/* Volume — sits directly below Add to Library so it's in the
              same visual stack rather than floating at the window corner. */}
          <VolumeChip volume={volume} onChange={setVolume} />
        </div>

        {/* Lyrics side panel — pure liquid glass */}
        <AnimatePresence>
          {lyricsOpen && (
            <motion.div
              key="lyrics-panel"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 h-full min-h-0 max-w-2xl rounded-3xl overflow-hidden relative"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px -24px rgba(0,0,0,0.6)',
              }}
            >
              <LyricsPanel compact />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Queue drawer (right side, existing component) */}
      <QueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  )
}

function VolumeChip({
  volume,
  onChange,
}: {
  volume: number
  onChange: (v: number) => void
}) {
  const muted = volume === 0
  const Icon = muted ? VolumeX : volume < 0.35 ? Volume1 : Volume2
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
      <button
        onClick={() => onChange(muted ? 0.7 : 0)}
        className="text-white/80 hover:text-white transition"
        title={muted ? 'Unmute' : 'Mute'}
      >
        <Icon size={15} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-24 accent-white/80 cursor-pointer"
        aria-label="Volume"
      />
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close Now Playing"
      title="Back (Esc)"
      className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-xl border border-white/[0.08] transition"
    >
      <ChevronDown size={18} />
    </button>
  )
}

function ToolChip({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl transition border',
        active
          ? 'bg-white/[0.12] border-white/[0.18] text-white'
          : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function GlassBtn({
  children,
  onClick,
  active,
  title,
  small,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  title: string
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        'rounded-full flex items-center justify-center backdrop-blur-xl transition border',
        active
          ? 'accent-text bg-white/[0.12] border-white/[0.18]'
          : 'text-white/85 bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.12] hover:text-white',
      )}
      style={{
        width: small ? 'clamp(32px, 4vh, 40px)' : 'clamp(40px, 5vh, 50px)',
        height: small ? 'clamp(32px, 4vh, 40px)' : 'clamp(40px, 5vh, 50px)',
      }}
    >
      {children}
    </button>
  )
}

function PlayBtn({ onClick, playing }: { onClick: () => void; playing: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={playing ? 'Pause' : 'Play'}
      className="rounded-full bg-white text-obsidian-950 flex items-center justify-center hover:bg-white/95 active:scale-95 transition shadow-[0_10px_30px_-6px_rgba(255,255,255,0.35)]"
      style={{
        width: 'clamp(54px, 7vh, 72px)',
        height: 'clamp(54px, 7vh, 72px)',
      }}
    >
      {playing ? (
        <Pause size={24} fill="currentColor" />
      ) : (
        <Play size={24} fill="currentColor" className="translate-x-[2px]" />
      )}
    </button>
  )
}
