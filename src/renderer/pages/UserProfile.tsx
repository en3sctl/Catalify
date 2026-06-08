import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Check, ListMusic, Play, UserPlus } from 'lucide-react'
import { FollowListModal } from '../components/FollowListModal'
import {
  FriendUser,
  SharedPlaylist,
  followUser,
  getUserByHandle,
  getUserPlaylists,
  unfollowUser,
} from '../utils/social-api'
import { Avatar } from '../components/UserRow'
import { playSongs } from '../utils/musickit-api'
import { artworkUrl, clsx } from '../utils/format'
import { toast } from '../store/toast'

/** Read-only profile of another Çatalify user: follow + their shared playlists. */
export function UserProfile() {
  const { handle } = useParams<{ handle: string }>()
  const [user, setUser] = useState<FriendUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [playlists, setPlaylists] = useState<SharedPlaylist[]>([])
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modalWhich, setModalWhich] = useState<'followers' | 'following' | null>(null)

  useEffect(() => {
    if (!handle) return
    setLoading(true)
    setModalWhich(null)
    getUserByHandle(handle)
      .then((u) => {
        setUser(u)
        setFollowing(!!u?.isFollowing)
        if (u) getUserPlaylists(u.id).then(setPlaylists)
      })
      .finally(() => setLoading(false))
  }, [handle])

  const toggle = async () => {
    if (!user) return
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

  if (loading) return <div className="text-obsidian-400">Loading…</div>
  if (!user) return <div className="text-obsidian-400">User not found.</div>

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end gap-6">
        <Avatar name={user.displayName || user.handle} src={user.avatarUrl} size={140} />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-[0.25em] text-cream/55">Profile</div>
          <h1 className="mt-1 text-4xl md:text-6xl font-display font-bold tracking-[-0.025em] leading-[1] truncate">
            {user.displayName}
          </h1>
          <div className="mt-1.5 text-[15px] text-cream/55">@{user.handle}</div>
          {user.bio && <p className="mt-2 text-[13.5px] text-obsidian-300 max-w-lg">{user.bio}</p>}
          <div className="mt-3 flex items-center gap-5 text-[13px] text-obsidian-300">
            {(() => {
              const canView = !user.hideLists || user.isMe
              const Count = ({ n, label, which }: { n: number; label: string; which: 'followers' | 'following' }) =>
                canView ? (
                  <button onClick={() => setModalWhich(which)} className="hover:text-cream transition">
                    <b className="text-cream">{n}</b> {label}
                  </button>
                ) : (
                  <span><b className="text-cream">{n}</b> {label}</span>
                )
              return (
                <>
                  <Count n={user.followers ?? 0} label="followers" which="followers" />
                  <Count n={user.following ?? 0} label="following" which="following" />
                </>
              )
            })()}
          </div>
          {!user.isMe && (
            <button
              onClick={toggle}
              disabled={busy}
              className={clsx(
                'mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition disabled:opacity-60',
                following
                  ? 'bg-white/[0.06] text-cream hover:bg-white/[0.1]'
                  : 'accent-bg text-obsidian-950 hover:brightness-110 shadow-glow',
              )}
            >
              {following ? <><Check size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
            </button>
          )}
        </div>
      </section>

      {/* Shared playlists */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ListMusic size={18} className="accent-text" />
          <h2 className="font-display text-[22px] font-bold tracking-tight leading-none">Shared playlists</h2>
        </div>
        {playlists.length === 0 ? (
          <p className="text-[13px] text-obsidian-400 italic">
            {user.displayName} hasn't shared any playlists yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map((pl) => (
              <SharedPlaylistCard key={pl.applePlaylistId} pl={pl} userId={user.id} />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {modalWhich && (
          <FollowListModal userId={user.id} which={modalWhich} onClose={() => setModalWhich(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function SharedPlaylistCard({ pl, userId }: { pl: SharedPlaylist; userId: number }) {
  const play = () => {
    const ids = (pl.trackIds || []).filter((id) => id && !/^i\./i.test(id))
    if (ids.length === 0) {
      toast.info('Nothing to play', 'This shared playlist has no streamable tracks.')
      return
    }
    playSongs(ids, 0).catch(console.error)
  }
  return (
    <Link
      to={`/shared/${userId}/${encodeURIComponent(pl.applePlaylistId)}`}
      className="group block rounded-xl p-3 hover:bg-white/[0.04] transition"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-obsidian-800 shadow-deep">
        {pl.artUrl ? (
          <img src={artworkUrl(pl.artUrl, 400)} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgb(var(--accent) / 0.6), rgb(var(--accent-soft) / 0.5))' }}
          >
            <ListMusic size={32} className="text-obsidian-950/70" />
          </div>
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            play()
          }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full accent-bg text-obsidian-950 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition shadow-glow flex items-center justify-center"
          aria-label="Play"
        >
          <Play size={15} fill="currentColor" className="translate-x-[1px]" />
        </button>
      </div>
      <div className="mt-3 truncate text-[13.5px] font-semibold text-white">{pl.title || 'Playlist'}</div>
      <div className="truncate text-[12px] text-obsidian-300">{(pl.trackIds || []).length} songs</div>
    </Link>
  )
}
