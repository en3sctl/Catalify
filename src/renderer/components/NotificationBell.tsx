import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '../store/notifications'
import { Avatar } from './UserRow'
import { timeAgo } from '../utils/format'

/** Sidebar notification bell + history panel (follows for now). Shows an
 *  unseen badge; opening the panel marks everything seen. */
export function NotificationBell() {
  const items = useNotifications((s) => s.items)
  const unseen = useNotifications((s) => s.unseen)
  const ready = useNotifications((s) => s.ready)
  const markSeen = useNotifications((s) => s.markSeen)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!ready) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) markSeen()
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={toggle}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-obsidian-300 hover:text-cream hover:bg-white/[0.06] transition"
        title="Notifications"
      >
        <Bell size={17} />
        {unseen > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full accent-bg text-obsidian-950 text-[9px] font-bold flex items-center justify-center">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="absolute bottom-full mb-2 left-0 z-50 w-[280px] max-h-[340px] overflow-y-auto rounded-2xl liquid-glass border border-white/[0.08] shadow-deep p-2"
            >
              <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] text-cream/40 font-semibold">
                Notifications
              </div>
              {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-obsidian-400 text-sm">Nothing yet.</div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.at + n.user.handle}
                    onClick={() => {
                      navigate(`/u/${n.user.handle}`)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition text-left"
                  >
                    <Avatar name={n.user.displayName || n.user.handle} src={n.user.avatarUrl} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] text-cream">
                        {n.type === 'react' ? (
                          <>
                            <b>{n.user.displayName}</b> reacted {n.emoji}
                            {n.trackTitle ? ` to "${n.trackTitle}"` : ''}
                          </>
                        ) : (
                          <>
                            <b>{n.user.displayName}</b> started following you
                          </>
                        )}
                      </div>
                      <div className="text-[10.5px] text-cream/40">{timeAgo(n.at)}</div>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
