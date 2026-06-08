import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { FriendUser, getUserFollowers, getUserFollowing } from '../utils/social-api'
import { UserRow } from './UserRow'

/** Modal listing a user's followers or following (respects the backend's
 *  privacy flag — a hidden list just comes back empty for non-owners). */
export function FollowListModal({
  userId,
  which,
  onClose,
}: {
  userId: number
  which: 'followers' | 'following'
  onClose: () => void
}) {
  const [users, setUsers] = useState<FriendUser[] | null>(null)

  useEffect(() => {
    const fn = which === 'followers' ? getUserFollowers : getUserFollowing
    let alive = true
    fn(userId).then((u) => {
      if (alive) setUsers(u)
    })
    return () => {
      alive = false
    }
  }, [userId, which])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.96, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[70vh] rounded-2xl liquid-glass border border-white/[0.08] shadow-deep flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="font-display text-[18px] font-bold capitalize">{which}</h3>
          <button onClick={onClose} className="text-obsidian-400 hover:text-cream transition">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-2" onClick={onClose}>
          {users === null ? (
            <div className="px-3 py-6 text-center text-obsidian-400 text-sm">Loading…</div>
          ) : users.length === 0 ? (
            <div className="px-3 py-6 text-center text-obsidian-400 text-sm">No {which} yet.</div>
          ) : (
            users.map((u) => <UserRow key={u.id} user={u} />)
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
