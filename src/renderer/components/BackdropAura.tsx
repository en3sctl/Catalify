import { AnimatePresence, motion } from 'framer-motion'
import { usePlayer } from '../store/player'
import { artworkUrl as artUrl } from '../utils/format'

/**
 * Full-window ambient backdrop driven by the now-playing artwork.
 *
 * Layers (back → front):
 *   1. base obsidian fill — fallback when nothing's playing
 *   2. heavily-blurred current artwork, crossfaded on track change
 *   3. radial accent washes derived from `--accent` / `--accent-soft`
 *   4. bottom-to-top darken so the NowPlayingBar still reads
 *
 * Sits behind everything in DOM order (no z-index needed); chrome
 * surfaces (Sidebar, NowPlayingBar, TitleBar) declare their own
 * z-30/40/50 and pick up colour through their backdrop-blur.
 */
export function BackdropAura() {
  const art = usePlayer((s) => s.nowPlaying?.artworkUrl)
  const url = art ? artUrl(art, 1200) : undefined

  return (
    <div
      aria-hidden
      className="fixed inset-0 overflow-hidden pointer-events-none bg-obsidian-950"
    >
      <AnimatePresence>
        {url && (
          <motion.img
            key={url}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: 'scale(1.35)',
              filter: 'blur(90px) saturate(170%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Per-track accent wash — uses the same CSS vars useArtColors writes,
          so even when artwork hasn't loaded yet the room is tinted. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 70% 25%, rgb(var(--accent) / 0.22), transparent 70%),' +
            'radial-gradient(80% 60% at 15% 95%, rgb(var(--accent-soft) / 0.16), transparent 70%)',
        }}
      />

      {/* Bottom darken so the now-playing bar has contrast against the wash. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,4,12,0) 35%, rgba(6,4,12,0.55) 100%)',
        }}
      />
    </div>
  )
}
