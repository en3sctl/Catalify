import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Heart, ListMusic, Loader2, Music2, Play, Shuffle, UserPlus } from 'lucide-react'
import { FollowListModal } from '../components/FollowListModal'
import {
  FriendUser,
  REACTION_EMOJI,
  SharedPlaylist,
  UserPresence,
  followUser,
  getBlend,
  getUserByHandle,
  getUserPlaylists,
  getUserPresence,
  reactToUser,
  unfollowUser,
} from '../utils/social-api'
import { useSocial } from '../store/social'
import { Avatar } from '../components/UserRow'
import { createLibraryPlaylist, getArtistsTopSongs, getCatalogSongsByIds, playSongs } from '../utils/musickit-api'
import { artworkUrl, clsx, timeAgo } from '../utils/format'
import { toast } from '../store/toast'
import { badgeById } from '../utils/badges'
import { BadgeMedal } from '../components/BadgeMedal'
import { useT } from '../i18n'

/**
 * Medal wall for the header card's right column — fills the empty space
 * next to the identity block, packed from the top-left. Each medal flips
 * on click to reveal how it's earned. Shows up to 6; overflow collapses
 * into a "+N" button that opens a scrollable all-badges popup. Ids resolve
 * against the local BADGE_DEFS; unknown ids (newer versions) are skipped.
 */
const BADGE_WALL_MAX = 6

function ProfileBadges({ ids }: { ids?: string[] }) {
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const defs = (ids ?? []).map(badgeById).filter((b): b is NonNullable<typeof b> => !!b)
  if (defs.length === 0) return null
  const overflow = defs.length - BADGE_WALL_MAX
  return (
    <div className="flex flex-col gap-3 content-start self-start flex-shrink-0 w-full sm:w-[240px]">
      <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 justify-items-start">
        {defs.slice(0, BADGE_WALL_MAX).map((b) => (
          <BadgeMedal key={b.id} def={b} size={66} />
        ))}
      </div>
      {overflow > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="self-start px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-[11.5px] font-semibold text-cream/80 hover:text-cream transition"
        >
          +{overflow} {t('badgesMore')}
        </button>
      )}
      <AnimatePresence>
        {showAll && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55"
              onClick={() => setShowAll(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative glass rounded-3xl p-6 shadow-deep w-[min(92vw,460px)]"
            >
              <div className="text-[12px] uppercase tracking-[0.2em] text-cream/60 font-semibold mb-5">
                {t('badges')}
              </div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-4 max-h-[60vh] overflow-y-auto justify-items-center pr-1">
                {defs.map((b) => (
                  <BadgeMedal key={b.id} def={b} size={76} />
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * One batched catalog lookup: each shared playlist's first streamable
 * track → its album art template. Used as the cover fallback when the
 * shared (signed, expiring) playlist art URL has gone stale.
 */
async function resolveCoverFallbacks(pls: SharedPlaylist[]): Promise<Record<string, string>> {
  const firstIds = new Map<string, string>() // songId → applePlaylistId
  for (const p of pls) {
    const id = (p.trackIds || []).find((t) => t && !/^i\./i.test(t))
    if (id && !firstIds.has(id)) firstIds.set(id, p.applePlaylistId)
  }
  if (firstIds.size === 0) return {}
  try {
    const songs = await getCatalogSongsByIds([...firstIds.keys()])
    const out: Record<string, string> = {}
    for (const s of songs ?? []) {
      const pid = firstIds.get(String(s?.id))
      const art = s?.attributes?.artwork?.url
      if (pid && art) out[pid] = art
    }
    return out
  } catch {
    return {}
  }
}

/** Read-only profile of another Çatalify user: follow + their shared playlists. */
export function UserProfile() {
  const { handle } = useParams<{ handle: string }>()
  const [user, setUser] = useState<FriendUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [playlists, setPlaylists] = useState<SharedPlaylist[]>([])
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modalWhich, setModalWhich] = useState<'followers' | 'following' | null>(null)
  const [presence, setPresence] = useState<UserPresence | null>(null)
  // applePlaylistId → fresh cover art template, resolved from each shared
  // playlist's first track. The art_url the owner shared is a SIGNED Apple
  // template that expires after a few weeks — without this fallback old
  // shares render as broken images.
  const [coverFix, setCoverFix] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!handle) return
    setLoading(true)
    setModalWhich(null)
    setPresence(null)
    setCoverFix({})
    getUserByHandle(handle)
      .then((u) => {
        setUser(u)
        setFollowing(!!u?.isFollowing)
        if (u) {
          getUserPlaylists(u.id).then((pls) => {
            setPlaylists(pls)
            resolveCoverFallbacks(pls).then(setCoverFix)
          })
          getUserPresence(u.id).then(setPresence)
        }
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
      {/* Header — one tidy glass card: avatar + identity on the left,
          follow action pinned right, counts as pill chips underneath. */}
      <section className="liquid-glass rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-shrink-0">
            <Avatar name={user.displayName || user.handle} src={user.avatarUrl} size={120} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.25em] text-cream/50 font-semibold">
              Profile
            </div>
            <h1 className="mt-1 text-3xl md:text-5xl font-display font-bold tracking-[-0.025em] leading-[1.05] truncate">
              {user.displayName}
            </h1>
            <div className="mt-1.5 flex items-center gap-2 text-[14px] text-cream/55 min-w-0">
              <span className="truncate">@{user.handle}</span>
            </div>
            {user.bio && (
              <p className="mt-2 text-[13px] text-obsidian-300 max-w-lg line-clamp-2">{user.bio}</p>
            )}
            <div className="mt-3.5 flex items-center gap-2 text-[12.5px]">
              {(() => {
                const canView = !user.hideLists || user.isMe
                const Count = ({ n, label, which }: { n: number; label: string; which: 'followers' | 'following' }) => {
                  const inner = (
                    <>
                      <b className="text-cream">{n}</b>
                      <span className="text-cream/60">{label}</span>
                    </>
                  )
                  const chip =
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.06]'
                  return canView ? (
                    <button
                      onClick={() => setModalWhich(which)}
                      className={clsx(chip, 'hover:bg-white/[0.09] transition')}
                    >
                      {inner}
                    </button>
                  ) : (
                    <span className={chip}>{inner}</span>
                  )
                }
                return (
                  <>
                    <Count n={user.followers ?? 0} label="followers" which="followers" />
                    <Count n={user.following ?? 0} label="following" which="following" />
                  </>
                )
              })()}
              {!user.isMe && (
                <button
                  onClick={toggle}
                  disabled={busy}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-semibold transition disabled:opacity-60',
                    following
                      ? 'bg-white/[0.06] text-cream hover:bg-white/[0.1] border border-white/[0.08]'
                      : 'accent-bg text-obsidian-950 hover:brightness-110 shadow-glow',
                  )}
                >
                  {following ? <><Check size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                </button>
              )}
            </div>
          </div>
          <ProfileBadges ids={user.badges} />
        </div>

        {/* Now playing / last played lives inside the header card so the
            page reads as one block instead of loose floating pieces. Its
            async pop-in only grows the card, never reflows the identity row. */}
        {presence && presence.title && (
          <div className="mt-5 max-w-md">
            <NowPlayingBanner presence={presence} user={user} />
          </div>
        )}
      </section>

      {/* Favorites showcase */}
      {(user.favoriteArtist || user.favoriteSong) && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Heart size={18} className="accent-text" />
            <h2 className="font-display text-[22px] font-bold tracking-tight leading-none">Favorites</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            {user.favoriteArtist && (
              <Link
                to={`/artist/${user.favoriteArtist.id}`}
                className="flex-1 flex items-center gap-3 rounded-2xl liquid-glass p-3 hover:bg-white/[0.06] transition min-w-0"
              >
                <img
                  src={user.favoriteArtist.artUrl ?? undefined}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover bg-white/[0.06] flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-obsidian-400 font-semibold">
                    Favorite artist
                  </div>
                  <div className="text-[14.5px] font-semibold text-cream truncate mt-0.5">
                    {user.favoriteArtist.name}
                  </div>
                </div>
              </Link>
            )}
            {user.favoriteSong && (
              <div className="flex-1 flex items-center gap-3 rounded-2xl liquid-glass p-3 min-w-0">
                <img
                  src={user.favoriteSong.artUrl ?? undefined}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover bg-white/[0.06] flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-obsidian-400 font-semibold">
                    Favorite song
                  </div>
                  <div className="text-[14.5px] font-semibold text-cream truncate mt-0.5">
                    {user.favoriteSong.name}
                  </div>
                  {user.favoriteSong.artistName && (
                    <div className="text-[12px] text-obsidian-300 truncate">{user.favoriteSong.artistName}</div>
                  )}
                </div>
                {!/^i\./i.test(user.favoriteSong.id) && (
                  <button
                    onClick={() => playSongs([user.favoriteSong!.id]).catch(console.error)}
                    className="w-10 h-10 rounded-full accent-bg text-obsidian-950 hover:brightness-110 transition flex items-center justify-center flex-shrink-0"
                    aria-label="Play favorite song"
                  >
                    <Play size={14} fill="currentColor" className="translate-x-[1px]" />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Blend */}
      {!user.isMe && <BlendCard user={user} />}

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
              <SharedPlaylistCard
                key={pl.applePlaylistId}
                pl={pl}
                userId={user.id}
                fallbackArt={coverFix[pl.applePlaylistId]}
              />
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

/**
 * Blend (v0.1.22): mixes my taste with this user's — shared artists first,
 * then an alternating pick of each side's exclusives — resolves to top
 * songs and plays as one list. Set math happens on catalify-api
 * (GET /blend/:userId); resolving artist → songs happens here via Apple.
 */
function BlendCard({ user }: { user: FriendUser }) {
  const me = useSocial((s) => s.user)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [matchPct, setMatchPct] = useState<number | null>(null)

  if (!me) return null

  /** Resolve the blend to a playable song-id list (shared throughout). */
  const buildBlendSongs = async () => {
    const blend = await getBlend(user.id)
    setMatchPct(blend.matchPct)
    // Shared artists carry the blend; exclusives alternate mine/theirs
    // so both tastes stay represented even at 0% overlap.
    const alternating: string[] = []
    const a = blend.mineOnly.slice(), b = blend.theirsOnly.slice()
    while (alternating.length < 12 && (a.length || b.length)) {
      const m = a.shift(); if (m) alternating.push(m)
      const t = b.shift(); if (t) alternating.push(t)
    }
    const artistIds = [...blend.shared.slice(0, 10), ...alternating].slice(0, 16)
    if (artistIds.length === 0) return { blend, ids: [] as string[] }
    const songs = await getArtistsTopSongs(artistIds, 3)
    return { blend, ids: songs.map((s) => s.id).slice(0, 40) }
  }

  const blendError = (err: any) => {
    if (err?.code === 'no_taste_them') {
      toast.info('No Blend yet', `@${user.handle} hasn't synced their taste yet — ask them to update Çatalify and open it once.`)
    } else if (err?.code === 'no_taste_me') {
      toast.info('No taste data yet', 'Follow a few artists first — your taste syncs automatically.')
    } else {
      toast.error('Blend failed', err?.message || String(err))
    }
  }

  const playBlend = async () => {
    setBusy(true)
    try {
      const { blend, ids } = await buildBlendSongs()
      if (ids.length === 0) {
        toast.info('Blend came up empty', 'Not enough taste data on either side yet.')
        return
      }
      await playSongs(ids, 0)
      toast.success(`Blend with @${user.handle}`, `${blend.matchPct}% taste match — enjoy!`)
    } catch (err: any) {
      blendError(err)
    } finally {
      setBusy(false)
    }
  }

  const saveBlend = async () => {
    setSaving(true)
    try {
      const { ids } = await buildBlendSongs()
      if (ids.length === 0) {
        toast.info('Blend came up empty', 'Not enough taste data on either side yet.')
        return
      }
      await createLibraryPlaylist(
        `Blend: ${me.handle} × ${user.handle}`,
        `Made in Çatalify from @${me.handle} and @${user.handle}'s shared taste.`,
        ids,
      )
      toast.success('Blend saved', 'Added to your Apple Music library as a playlist.')
    } catch (err: any) {
      blendError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="max-w-2xl">
      <div className="rounded-2xl liquid-glass p-4 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent) / 0.75), rgb(var(--accent-soft) / 0.55))' }}
        >
          <Shuffle size={22} className="text-obsidian-950" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-display font-bold text-cream">
            Blend with @{user.handle}
          </div>
          <p className="text-[12.5px] text-obsidian-300 mt-0.5">
            {matchPct !== null
              ? `${matchPct}% taste match — one mixed queue from both of your artists.`
              : 'One playlist from both of your music tastes.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={saveBlend}
            disabled={saving || busy}
            title="Save this Blend to your Apple Music library"
            className="px-4 py-2 rounded-full bg-white/[0.06] text-cream font-semibold text-[12.5px] hover:bg-white/[0.1] disabled:opacity-60 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={playBlend}
            disabled={busy || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full accent-bg text-obsidian-950 font-semibold text-[12.5px] hover:brightness-110 disabled:opacity-60 transition"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            {busy ? 'Mixing…' : 'Play Blend'}
          </button>
        </div>
      </div>
    </section>
  )
}

function NowPlayingBanner({ presence, user }: { presence: UserPresence; user: FriendUser }) {
  const live = presence.isPlaying && Date.now() / 1000 - presence.updatedAt < 150
  const listenAlong = useSocial((s) => s.listenAlong)
  const setListenAlong = useSocial((s) => s.setListenAlong)
  const alongActive = listenAlong?.userId === user.id
  const [reacted, setReacted] = useState<string | null>(null)

  const sendReaction = async (emoji: string) => {
    setReacted(emoji)
    try {
      await reactToUser(user.id, emoji, presence.title)
    } catch (err: any) {
      setReacted(null)
      toast.error('Reaction failed', err?.message || String(err))
    }
  }

  return (
    <div className="rounded-2xl liquid-glass p-3">
      <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-obsidian-800 flex-shrink-0">
        {presence.artUrl ? (
          <img src={artworkUrl(presence.artUrl, 120)} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 size={18} className="text-cream/40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={clsx('text-[10.5px] uppercase tracking-[0.12em] font-semibold', live ? 'accent-text' : 'text-cream/40')}>
          {live ? '● Listening now' : `Last played · ${timeAgo(presence.updatedAt)}`}
        </div>
        <div className="truncate text-[13.5px] font-semibold text-cream mt-0.5">{presence.title}</div>
        <div className="truncate text-[12px] text-obsidian-300">{presence.artist}</div>
      </div>
      {presence.trackId && !/^i\./i.test(presence.trackId) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {live && (
            <button
              onClick={() =>
                alongActive
                  ? setListenAlong(null)
                  : setListenAlong({ userId: user.id, handle: user.handle })
              }
              className={clsx(
                'px-3.5 py-2 rounded-full font-semibold text-[12.5px] transition border',
                alongActive
                  ? 'accent-bg text-obsidian-950 border-transparent'
                  : 'bg-white/[0.06] text-cream border-white/[0.08] hover:bg-white/[0.1]',
              )}
              title={
                alongActive
                  ? 'Stop mirroring their playback'
                  : 'Mirror their playback — when they change songs, you do too'
              }
            >
              {alongActive ? '● Listening along' : 'Listen along'}
            </button>
          )}
          <button
            onClick={() => playSongs([presence.trackId as string]).catch(console.error)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full accent-bg text-obsidian-950 font-semibold text-[12.5px] hover:brightness-110 transition"
            title="Play what they're listening to"
          >
            <Play size={13} fill="currentColor" /> Join
          </button>
        </div>
      )}
      </div>

      {/* Emoji reactions — lands in their notification bell. */}
      {!user.isMe && (
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.05] flex items-center gap-1">
          {REACTION_EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => sendReaction(e)}
              disabled={reacted !== null}
              className={clsx(
                'w-8 h-8 rounded-lg text-[15px] flex items-center justify-center transition',
                reacted === e
                  ? 'bg-white/[0.12] scale-110'
                  : reacted
                    ? 'opacity-35'
                    : 'hover:bg-white/[0.08] hover:scale-110',
              )}
              title={`React ${e} to "${presence.title}"`}
            >
              {e}
            </button>
          ))}
          {reacted && <span className="ml-2 text-[11.5px] text-obsidian-300">Sent!</span>}
        </div>
      )}
    </div>
  )
}

function SharedPlaylistCard({
  pl,
  userId,
  fallbackArt,
}: {
  pl: SharedPlaylist
  userId: number
  fallbackArt?: string
}) {
  // Cover chain: shared art → first-track art (fresh) → gradient. The
  // shared URL is a signed Apple template that expires after a few weeks.
  const [failed, setFailed] = useState<string[]>([])
  const coverSrc = [artworkUrl(pl.artUrl ?? undefined, 400), artworkUrl(fallbackArt, 400)].find(
    (s) => s && !failed.includes(s),
  )
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
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setFailed((f) => [...f, coverSrc])}
            draggable={false}
          />
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
