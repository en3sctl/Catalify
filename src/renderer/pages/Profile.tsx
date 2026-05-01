import { useEffect, useRef, useState } from 'react'
import {
  LogOut,
  Camera,
  Heart,
  Disc3,
  ListMusic,
  Users,
  Pencil,
  Check,
  X,
  Settings as SettingsIcon,
} from 'lucide-react'
import { usePlayer } from '../store/player'
import {
  getCatalogArtistsByIds,
  getHeavyRotation,
  getLibraryPlaylists,
  unauthorize,
} from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { artworkUrl, clsx } from '../utils/format'
import { Link } from 'react-router-dom'

/**
 * Personal profile page — sits at /profile, replaces the old in-sidebar
 * Sign out chip so the destructive action lives behind one extra tap.
 *
 * What we own here:
 *   - Avatar (locally chosen image, resized + base64-cached in
 *     electron-store under `profileAvatar`)
 *   - Display name (Apple's `/v1/me` doesn't surface a real name, so the
 *     user types one; persists as `profileName`)
 *   - Storefront badge (read off the live MusicKit instance)
 *   - At-a-glance counts: liked tracks, saved albums, followed artists,
 *     library playlists
 *   - Heavy-rotation grid (small "what you've been playing" rail)
 *   - Sign out, intentionally tucked at the bottom away from common taps
 */
export function Profile() {
  const likedCount = usePlayer((s) => Object.keys(s.likedIds).length)
  const savedAlbums = usePlayer((s) => Object.keys(s.librarySaved.albums).length)
  const followedArtistIds = usePlayer((s) =>
    Object.keys(s.librarySaved.artists).filter((id) => s.librarySaved.artists[id]),
  )

  const [name, setName] = useState('')
  const [draftName, setDraftName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [storefront, setStorefront] = useState('')
  const [rotation, setRotation] = useState<any[]>([])
  const [followingArtists, setFollowingArtists] = useState<any[]>([])
  const [playlistCount, setPlaylistCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.bombo.store.get<string>('profileName').then((v) => {
      setName(v || '')
      setDraftName(v || '')
    })
    window.bombo.store.get<string>('profileAvatar').then((v) => setAvatar(v || null))
    try {
      const sf =
        (window as any).MusicKit?.getInstance?.()?.storefrontId || ''
      setStorefront(typeof sf === 'string' ? sf.toUpperCase() : '')
    } catch {}
    Promise.all([
      getHeavyRotation(10).catch(() => []),
      getLibraryPlaylists(100).catch(() => []),
    ]).then(([rot, pls]) => {
      setRotation(Array.isArray(rot) ? rot : [])
      setPlaylistCount(Array.isArray(pls) ? pls.length : 0)
    })
  }, [])

  // Hydrate the "Following" grid by resolving the catalog IDs we've
  // saved locally into full artist objects. Re-runs whenever the user
  // follows / unfollows so the grid stays accurate without a refresh.
  useEffect(() => {
    if (followedArtistIds.length === 0) {
      setFollowingArtists([])
      return
    }
    let cancelled = false
    getCatalogArtistsByIds(followedArtistIds)
      .then((list) => {
        if (!cancelled) setFollowingArtists(list)
      })
      .catch((err) => {
        console.warn('[profile] following artists resolve failed', err)
        if (!cancelled) setFollowingArtists([])
      })
    return () => {
      cancelled = true
    }
  }, [followedArtistIds.join(',')])

  const onPickAvatar = () => fileRef.current?.click()
  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      const dataUrl = await resizeImageToDataUrl(file, 320)
      setAvatar(dataUrl)
      window.bombo.store.set('profileAvatar', dataUrl)
    } catch (err) {
      console.warn('avatar resize failed', err)
    }
  }

  const saveName = () => {
    const next = draftName.trim().slice(0, 64)
    setName(next)
    window.bombo.store.set('profileName', next)
    setEditingName(false)
  }

  const cancelName = () => {
    setDraftName(name)
    setEditingName(false)
  }

  return (
    <div className="space-y-10 pb-16">
      {/* Top-right action bar — Storefront chip + Settings + Sign out */}
      <div className="flex items-center justify-end gap-2 -mt-2 flex-wrap">
        {storefront && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-[11.5px] text-cream/75">
            <span className="opacity-70">Storefront</span>
            <span className="font-mono">{storefront}</span>
          </div>
        )}
        <Link
          to="/settings"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-cream/80 hover:text-cream text-[12.5px] transition"
          title="Settings"
        >
          <SettingsIcon size={14} /> Settings
        </Link>
        <button
          onClick={() => {
            if (!confirm('Sign out of Apple Music?')) return
            unauthorize().then(() => location.reload())
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] hover:bg-red-500/15 hover:text-red-300 border border-white/[0.06] hover:border-red-500/30 text-cream/80 text-[12.5px] transition"
          title="Sign out"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      {/* Header — avatar + name + storefront chip */}
      <section className="flex flex-col md:flex-row md:items-end gap-6">
        <div className="relative group/avatar flex-shrink-0">
          <div className="w-40 h-40 rounded-full overflow-hidden bg-white/[0.05] border border-white/[0.08] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                draggable={false}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-display text-cream/60">
                {(name || 'You').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={onPickAvatar}
            title="Change avatar"
            className="absolute bottom-1 right-1 w-10 h-10 rounded-full flex items-center justify-center bg-black/55 text-cream backdrop-blur-md border border-white/[0.12] opacity-0 group-hover/avatar:opacity-100 transition"
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onAvatarChange}
            className="hidden"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-[0.25em] text-cream/55">
            Profile
          </div>
          {editingName ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') cancelName()
                }}
                placeholder="Your name"
                autoFocus
                className="bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-3xl md:text-4xl font-display tracking-tight outline-none flex-1 min-w-0"
              />
              <button
                onClick={saveName}
                className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center transition"
                title="Save"
              >
                <Check size={16} />
              </button>
              <button
                onClick={cancelName}
                className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="mt-1 group/name inline-flex items-center gap-3 max-w-full"
              title="Edit display name"
            >
              <h1 className="text-4xl md:text-6xl font-display font-bold tracking-[-0.025em] leading-[1] truncate">
                {name || 'Your name'}
              </h1>
              <Pencil
                size={18}
                className="text-cream/40 opacity-0 group-hover/name:opacity-100 transition flex-shrink-0"
              />
            </button>
          )}
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Heart size={16} />} label="Liked" value={likedCount} to="/liked" />
        <Stat icon={<Disc3 size={16} />} label="Saved albums" value={savedAlbums} to="/library" />
        <Stat icon={<Users size={16} />} label="Following" value={followedArtistIds.length} />
        <Stat icon={<ListMusic size={16} />} label="Playlists" value={playlistCount} to="/library" />
      </section>

      {/* Heavy rotation — small grid, links into albums/playlists */}
      {rotation.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display text-[22px] font-bold tracking-tight leading-none">
                On heavy rotation
              </h2>
              <p className="text-[12.5px] text-cream/55 mt-1.5">
                What you've been playing the most lately
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {rotation.slice(0, 10).map((item) => {
              const attrs = item.attributes ?? {}
              const art = artworkUrl(attrs.artwork?.url, 500)
              const type = String(item.type ?? '')
              const cid = attrs.playParams?.catalogId || item.id
              const to = type.includes('album')
                ? `/album/${cid}`
                : type.includes('playlist')
                  ? `/playlist/${cid}`
                  : '#'
              return (
                <Link
                  key={item.id}
                  to={to}
                  className="group block rounded-xl p-2 hover:bg-white/[0.04] transition"
                >
                  <Artwork src={art} size="hero" rounded="lg" alt={attrs.name} />
                  <div className="mt-3 truncate text-[13px] font-semibold text-cream">
                    {attrs.name}
                  </div>
                  <div className="truncate text-[11.5px] text-cream/55 mt-0.5">
                    {attrs.artistName ?? attrs.curatorName ?? ''}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Following — round avatars, like Spotify's artist grid */}
      {followingArtists.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display text-[22px] font-bold tracking-tight leading-none">
                Following
              </h2>
              <p className="text-[12.5px] text-cream/55 mt-1.5">
                Artists you've followed in Çatalify
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {followingArtists.slice(0, 12).map((a) => (
              <Link
                key={a.id}
                to={`/artist/${a.id}`}
                className="group block rounded-xl p-2 hover:bg-white/[0.04] transition"
              >
                <Artwork
                  src={artworkUrl(a.attributes?.artwork?.url, 320)}
                  size="hero"
                  rounded="full"
                  alt={a.attributes?.name}
                />
                <div className="mt-2.5 text-center truncate text-[12.5px] font-semibold text-cream">
                  {a.attributes?.name}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode
  label: string
  value: number
  to?: string
}) {
  const content = (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-2xl transition',
        'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.09]',
        'backdrop-blur-xl',
      )}
    >
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] text-cream flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[18px] font-semibold text-cream tabular-nums">
          {value}
        </div>
        <div className="text-[11.5px] text-cream/55 truncate">{label}</div>
      </div>
    </div>
  )
  if (to) return <Link to={to}>{content}</Link>
  return content
}

/**
 * Read a user-picked image and return a square-ish JPEG data URL no
 * larger than `max` per side. Keeps electron-store payloads under a
 * few hundred KB even if the user picks a 4K avatar source.
 */
async function resizeImageToDataUrl(file: File, max: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(max / bitmap.width, max / bitmap.height, 1)
  const w = Math.max(1, Math.round(bitmap.width * ratio))
  const h = Math.max(1, Math.round(bitmap.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}
