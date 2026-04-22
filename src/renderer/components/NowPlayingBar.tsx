import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, ChevronUp, ChevronDown, Heart, ListMusic, Mic2,
  PictureInPicture2, Share2, Check, Maximize2,
} from 'lucide-react'
import { usePlayer } from '../store/player'
import { ProgressBar } from './ProgressBar'
import { artworkUrl, clsx } from '../utils/format'
import { QueueDrawer } from './QueueDrawer'
import { SleepTimer } from './SleepTimer'

export function NowPlayingBar() {
  const navigate = useNavigate()
  const np = usePlayer((s) => s.nowPlaying)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const volume = usePlayer((s) => s.volume)
  const setVolume = usePlayer((s) => s.setVolume)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const previous = usePlayer((s) => s.previous)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const cycleRepeat = usePlayer((s) => s.cycleRepeat)
  const likedIds = usePlayer((s) => s.likedIds)
  const toggleLike = usePlayer((s) => s.toggleLike)

  const [queueOpen, setQueueOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const liked = np ? !!likedIds[np.id] : false

  const share = async () => {
    if (!np) return
    try {
      const sf = (window as any).MusicKit?.getInstance?.()?.storefrontId || 'us'
      const url = `https://music.apple.com/${sf}/song/${np.id}`
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-[var(--nowplaying-h)] z-40 border-t border-white/[0.05] bg-[rgba(10,8,18,0.92)] backdrop-blur-xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-full px-5 gap-4">
          {/* Left: now-playing info */}
          <div className="flex items-center gap-3 min-w-0">
            {np ? (
              <>
                {/* Mini cover with Spotify-style expand arrow.
                    - Cover click or arrow click → toggles the floating
                      "expanded mini" card above the bar (Spotify pattern:
                      grows upward into the sidebar column).
                    - The separate Maximize2 button (to the right of
                      heart) is what takes you to the full-screen Now
                      Playing route — it's still morph-linked via
                      `layoutId`. */}
                <div className="relative flex-shrink-0 group/cover">
                  <motion.button
                    layoutId="np-hero-cover"
                    onClick={() => setExpanded((v) => !v)}
                    className="relative w-12 h-12 rounded-md overflow-hidden block"
                    style={{ boxShadow: '0 6px 16px -6px rgba(0,0,0,0.6)' }}
                    title={expanded ? 'Collapse' : 'Expand'}
                  >
                    {np.artworkUrl ? (
                      <img
                        src={artworkUrl(np.artworkUrl, 160)}
                        alt={np.title}
                        draggable={false}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-obsidian-800" />
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/cover:opacity-100 transition" />
                  </motion.button>
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    title={expanded ? 'Collapse' : 'Expand'}
                    aria-label={expanded ? 'Collapse mini player' : 'Expand mini player'}
                    className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-black text-white/90 flex items-center justify-center border border-white/15 shadow-md opacity-70 group-hover/cover:opacity-100 hover:bg-black/85 hover:scale-110 transition"
                  >
                    {expanded ? (
                      <ChevronDown size={12} strokeWidth={2.5} />
                    ) : (
                      <ChevronUp size={12} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-white">{np.title}</div>
                  <div className="truncate text-[12px] text-obsidian-300">
                    {np.artistName}
                    {np.albumName && <span className="text-obsidian-400"> · {np.albumName}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleLike(np.id)}
                  className={clsx('p-1.5 transition', liked ? 'accent-text' : 'text-obsidian-400 hover:text-white')}
                  title={liked ? 'Remove from Liked' : 'Add to Liked'}
                >
                  <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                </button>
                <Link
                  to="/now-playing"
                  className="p-1.5 text-obsidian-400 hover:text-white transition"
                  title="Open now playing"
                >
                  <Maximize2 size={15} />
                </Link>
              </>
            ) : (
              <div className="text-obsidian-400 text-[13px] italic">Nothing playing</div>
            )}
          </div>

          {/* Center: controls + progress */}
          <div className="flex flex-col items-center gap-2 min-w-[420px]">
            <div className="flex items-center gap-4">
              <IconBtn active={shuffle} onClick={toggleShuffle} title="Shuffle (S)" size="sm">
                <Shuffle size={15} />
              </IconBtn>
              <IconBtn onClick={previous} title="Previous (Ctrl+←)" size="md">
                <SkipBack size={18} fill="currentColor" />
              </IconBtn>
              <button
                onClick={toggle}
                className="w-10 h-10 rounded-full accent-bg text-obsidian-950 flex items-center justify-center hover:brightness-110 transition shadow-[0_0_20px_rgb(var(--accent)/0.35)]"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title="Play/Pause (Space)"
              >
                {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="translate-x-[1px]" />}
              </button>
              <IconBtn onClick={next} title="Next (Ctrl+→)" size="md">
                <SkipForward size={18} fill="currentColor" />
              </IconBtn>
              <IconBtn active={repeat !== 'none'} onClick={cycleRepeat} title={`Repeat: ${repeat} (R)`} size="sm">
                {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
              </IconBtn>
            </div>
            <ProgressBar />
          </div>

          {/* Right: extras + volume */}
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={share}
              className="p-2 rounded-lg text-obsidian-300 hover:text-cream hover:bg-white/[0.06] transition"
              title="Copy Apple Music link"
              disabled={!np}
            >
              {shared ? <Check size={15} className="accent-text" /> : <Share2 size={15} />}
            </button>
            <Link to="/lyrics" className="p-2 rounded-lg text-obsidian-300 hover:text-cream hover:bg-white/[0.06] transition" title="Lyrics">
              <Mic2 size={15} />
            </Link>
            <button onClick={() => setQueueOpen(true)} className="p-2 rounded-lg text-obsidian-300 hover:text-cream hover:bg-white/[0.06] transition" title="Queue">
              <ListMusic size={15} />
            </button>
            <SleepTimer />
            <button
              onClick={() => window.bombo.miniPlayer.open()}
              className="p-2 rounded-lg text-obsidian-300 hover:text-white hover:bg-white/[0.06] transition"
              title="Mini player"
            >
              <PictureInPicture2 size={15} />
            </button>
            <div className="flex items-center gap-2 ml-1">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className="text-obsidian-300 hover:text-white transition"
                title="Mute (M)"
              >
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 accent-white/80 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
      <QueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} />
      {np && (
        <ExpandedMini
          open={expanded}
          onClose={() => setExpanded(false)}
          art={np.artworkUrl}
          title={np.title}
          artist={np.artistName}
          album={np.albumName}
        />
      )}
    </>
  )
}

/**
 * Spotify-style "expand the mini player upward" card. Lives above the
 * NowPlayingBar and over the sidebar's lower area — shows a big cover +
 * track meta. Not the full /now-playing view (that's a separate button).
 */
function ExpandedMini({
  open,
  onClose,
  art,
  title,
  artist,
  album,
}: {
  open: boolean
  onClose: () => void
  art: string | undefined
  title: string
  artist: string
  album: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320, mass: 0.7 }}
          className="fixed z-40 rounded-2xl overflow-hidden"
          style={{
            left: 8,
            bottom: 'calc(var(--nowplaying-h) + 8px)',
            width: 'calc(var(--sidebar-w) - 16px)',
            transformOrigin: 'bottom left',
            background: 'rgba(18, 12, 26, 0.92)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow:
              '0 30px 60px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-black/45 text-white/80 hover:text-white hover:bg-black/70 transition"
            title="Collapse"
          >
            <ChevronDown size={14} />
          </button>
          <div className="p-3">
            <div className="aspect-square rounded-xl overflow-hidden shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)]">
              {art ? (
                <img
                  src={artworkUrl(art, 520)}
                  alt={title}
                  draggable={false}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-obsidian-800" />
              )}
            </div>
            <div className="mt-3 px-1">
              <div className="truncate text-[14px] font-semibold text-cream">{title}</div>
              <div className="truncate text-[12px] text-obsidian-300 mt-0.5">{artist}</div>
              {album && (
                <div className="truncate text-[11px] text-obsidian-400 mt-0.5">{album}</div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IconBtn({
  children, onClick, active, title, size = 'md',
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  title?: string
  size?: 'sm' | 'md'
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        'flex items-center justify-center transition relative',
        size === 'sm' ? 'w-8 h-8' : 'w-9 h-9',
        active ? 'accent-text' : 'text-obsidian-200 hover:text-white',
      )}
    >
      {children}
      {active && <span className="absolute bottom-0 w-1 h-1 rounded-full accent-bg"></span>}
    </button>
  )
}
