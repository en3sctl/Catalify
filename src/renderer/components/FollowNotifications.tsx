import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { UserPlus, X } from 'lucide-react'
import { useSocial } from '../store/social'
import { FollowNotification, getNotifications } from '../utils/social-api'
import { Avatar } from './UserRow'

/**
 * Discord-style top-right cards announcing new followers. Polls
 * /me/notifications, diffs against the last-seen timestamp (persisted), and
 * shows a card for each new follow — auto-dismissing after a few seconds.
 */
export function FollowNotifications() {
  const user = useSocial((s) => s.user)
  const navigate = useNavigate()
  const [cards, setCards] = useState<FollowNotification[]>([])

  useEffect(() => {
    if (!user) {
      setCards([])
      return
    }
    let alive = true
    let lastSeen: number | null = null
    const check = async () => {
      const notes = await getNotifications()
      if (!alive) return
      if (lastSeen === null) {
        const stored = await window.bombo.store.get<number>('socialLastFollowSeen')
        // Prime to the newest existing follow so we don't replay history.
        lastSeen = typeof stored === 'number' ? stored : notes[0]?.at ?? 0
        if (typeof stored !== 'number') window.bombo.store.set('socialLastFollowSeen', lastSeen)
      }
      const fresh = notes.filter((n) => n.at > (lastSeen as number))
      if (fresh.length > 0) {
        setCards((cur) => [...fresh.slice(0, 3), ...cur].slice(0, 4))
        lastSeen = Math.max(lastSeen as number, ...fresh.map((n) => n.at))
        window.bombo.store.set('socialLastFollowSeen', lastSeen)
      }
    }
    check()
    const id = window.setInterval(check, 30000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [user?.id])

  // Auto-dismiss the oldest card a few seconds after the stack changes.
  useEffect(() => {
    if (cards.length === 0) return
    const t = window.setTimeout(() => setCards((c) => c.slice(0, -1)), 7000)
    return () => window.clearTimeout(t)
  }, [cards])

  const dismiss = (at: number, handle: string) =>
    setCards((c) => c.filter((x) => !(x.at === at && x.user.handle === handle)))

  return (
    <div
      className="fixed right-4 z-[55] pointer-events-none flex flex-col gap-2"
      style={{ top: 'calc(var(--titlebar-h) + 12px)' }}
    >
      <AnimatePresence>
        {cards.map((n) => (
          <motion.div
            key={n.at + n.user.handle}
            initial={{ opacity: 0, x: 30, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="pointer-events-auto liquid-glass rounded-2xl p-3 w-[300px] flex items-center gap-3 shadow-deep"
          >
            <button
              onClick={() => {
                navigate(`/u/${n.user.handle}`)
                dismiss(n.at, n.user.handle)
              }}
              className="flex-shrink-0"
              title={`@${n.user.handle}`}
            >
              <Avatar name={n.user.displayName || n.user.handle} src={n.user.avatarUrl} size={38} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 accent-text">
                <UserPlus size={12} />
                <span className="text-[10px] uppercase tracking-[0.1em] font-semibold">New follower</span>
              </div>
              <div className="truncate text-[12.5px] text-cream mt-0.5">
                <b>{n.user.displayName}</b> started following you
              </div>
            </div>
            <button
              onClick={() => dismiss(n.at, n.user.handle)}
              className="text-obsidian-400 hover:text-cream transition flex-shrink-0"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
