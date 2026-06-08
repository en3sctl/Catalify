import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, UserPlus } from 'lucide-react'
import { FriendUser, followUser, unfollowUser } from '../utils/social-api'
import { clsx } from '../utils/format'
import { toast } from '../store/toast'

/** A user row with a Follow/Following toggle. Used in search + lists. */
export function UserRow({ user }: { user: FriendUser }) {
  const [following, setFollowing] = useState(!!user.isFollowing)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    const next = !following
    setFollowing(next)
    try {
      if (next) await followUser(user.id)
      else await unfollowUser(user.id)
    } catch (err: any) {
      setFollowing(!next)
      toast.error('Couldn\'t update follow', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition">
      <Link to={`/u/${user.handle}`} className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar name={user.displayName || user.handle} src={user.avatarUrl} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-cream">{user.displayName}</div>
          <div className="truncate text-[12px] text-cream/50">@{user.handle}</div>
        </div>
      </Link>
      {!user.isMe && (
        <button
          onClick={toggle}
          disabled={busy}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-medium transition flex-shrink-0 disabled:opacity-60',
            following
              ? 'bg-white/[0.06] text-cream hover:bg-white/[0.1]'
              : 'accent-bg text-obsidian-950 hover:brightness-110',
          )}
        >
          {following ? (
            <>
              <Check size={13} /> Following
            </>
          ) : (
            <>
              <UserPlus size={13} /> Follow
            </>
          )}
        </button>
      )}
    </div>
  )
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className="rounded-full object-cover border border-white/[0.08] flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-display text-cream/70 flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || 'U').slice(0, 1).toUpperCase()}
    </div>
  )
}
