import { useEffect } from 'react'
import { usePlayer } from '../store/player'
import { useSocial } from '../store/social'
import { putPresence } from '../utils/social-api'

/**
 * Broadcasts the user's "now playing" to friends (Phase 4 presence), as
 * long as they have a Çatalify account AND haven't turned activity sharing
 * off. Sends on every track change / play-pause, plus a keep-alive every
 * 30 s while playing (presence goes stale server-side after ~12 min).
 * Best-effort — failures are swallowed in putPresence.
 */
export function usePresenceBroadcast() {
  const user = useSocial((s) => s.user)
  const shareActivity = useSocial((s) => s.shareActivity)
  const nowPlayingId = usePlayer((s) => s.nowPlaying?.id)
  const isPlaying = usePlayer((s) => s.isPlaying)

  useEffect(() => {
    if (!user) return
    // Sharing off → push a single "not playing" so friends drop us, then idle.
    if (!shareActivity) {
      putPresence({ trackId: null, title: '', artist: '', isPlaying: false })
      return
    }
    const send = () => {
      const np = usePlayer.getState().nowPlaying
      if (!np) return
      putPresence({
        trackId: np.id,
        title: np.title,
        artist: np.artistName,
        artUrl: np.artworkUrl ?? null,
        isPlaying: usePlayer.getState().isPlaying,
      })
    }
    send()
    const id = window.setInterval(() => {
      if (usePlayer.getState().isPlaying) send()
    }, 30000)
    return () => window.clearInterval(id)
  }, [user, shareActivity, nowPlayingId, isPlaying])
}
