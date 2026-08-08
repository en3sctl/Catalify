import { useEffect, useRef } from 'react'
import { useSocial } from '../store/social'
import { getUserPresence } from '../utils/social-api'
import { playSongs } from '../utils/musickit-api'
import { toast } from '../store/toast'

const POLL_MS = 10_000
// Presence keep-alive is ~30s; if a friend's row hasn't moved in 3 min
// they've stopped/closed the app — end the session instead of replaying
// their frozen last track forever.
const STALE_S = 180

/**
 * "Listen along" driver. While `useSocial.listenAlong` is set, polls that
 * friend's presence and mirrors their track changes into local playback.
 * Mount once in MainApp; the on/off switch lives on the friend's profile.
 */
export function useListenAlong() {
  const listenAlong = useSocial((s) => s.listenAlong)
  const lastTrackRef = useRef<string | null>(null)

  useEffect(() => {
    if (!listenAlong) {
      lastTrackRef.current = null
      return
    }
    const { userId, handle } = listenAlong
    let cancelled = false

    const tick = async () => {
      const p = await getUserPresence(userId)
      if (cancelled) return
      const stop = (title: string, msg: string) => {
        toast.info(title, msg)
        useSocial.getState().setListenAlong(null)
      }
      if (!p || !p.isPlaying || Date.now() / 1000 - p.updatedAt > STALE_S) {
        stop('Listen along ended', `@${handle} stopped listening.`)
        return
      }
      const tid = p.trackId
      if (!tid || /^i\./i.test(tid)) return // library-only track — wait for the next one
      if (tid !== lastTrackRef.current) {
        lastTrackRef.current = tid
        try {
          await playSongs([tid])
        } catch (err) {
          console.warn('[listenAlong] play failed', err)
        }
      }
    }

    tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [listenAlong])
}
