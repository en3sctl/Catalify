import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Shuffle, Pencil, Camera, Check, X } from 'lucide-react'
import {
  addToLibraryPlaylist,
  getLibraryPlaylist,
  getPlaylist,
  isLibraryId,
  playSongs,
} from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { PlaylistSongAdder, AdderTrack } from '../components/PlaylistSongAdder'
import { artworkUrl } from '../utils/format'
import { useExplicitFilter } from '../utils/explicit'
import { useLocalPlaylistCover, setPlaylistCover, removePlaylistCover } from '../utils/playlist-covers'
import { useLocalPlaylistMeta, setPlaylistMeta } from '../utils/playlist-meta'
import { resizeImageToDataUrl } from '../utils/image'
import { usePlayer } from '../store/player'
import { toast } from '../store/toast'

export function Playlist() {
  const { id } = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Songs added on this page after load (optimistic — Apple's list lags).
  const [extraTracks, setExtraTracks] = useState<any[]>([])
  const setShuffle = usePlayer((s) => s.setShuffle)

  // Library playlists (user-created, "p.xxx" / "pl.u-xxx") only resolve
  // through the library endpoint — the catalog endpoint 404s on them.
  const isLibrary = id ? isLibraryId(id) : false

  // ── Edit mode (cover + name + description, Çatalify-local overrides) ──
  const localCover = useLocalPlaylistCover(id)
  const meta = useLocalPlaylistMeta(id)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  // undefined = cover unchanged, null = cover removed, string = new data URL
  const [draftCover, setDraftCover] = useState<string | null | undefined>(undefined)
  const [savingEdit, setSavingEdit] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setExtraTracks([])
    setEditing(false)
    setDraftCover(undefined)
    const fetcher = isLibrary ? getLibraryPlaylist : getPlaylist
    fetcher(id)
      .then(setPlaylist)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, isLibrary])

  const fetchedTracks = useMemo(
    () => playlist?.relationships?.tracks?.data ?? [],
    [playlist],
  )
  const allTracks = useMemo(
    () => [...fetchedTracks, ...extraTracks],
    [fetchedTracks, extraTracks],
  )
  const tracks = useExplicitFilter<any>(allTracks)
  const attrs = playlist?.attributes ?? {}

  // Local overrides win over Apple's values everywhere they're shown.
  const displayName = meta?.name ?? attrs.name ?? ''
  const displayDescription = meta?.description ?? attrs.description?.short ?? ''
  // The custom cover (existing local, or the in-edit draft). null draft =
  // "removed" → fall through to Apple art.
  const shownCover =
    editing && draftCover !== undefined ? draftCover ?? undefined : localCover
  const artLarge = shownCover ?? artworkUrl(attrs.artwork?.url, 600)

  // Only the user's own library playlists can be edited / take new songs.
  const editable = isLibrary && attrs.canEdit !== false

  const existingIds = useMemo(
    () =>
      tracks
        .map((t: any) => String(t?.attributes?.playParams?.catalogId || t?.id || ''))
        .filter(Boolean),
    [tracks],
  )
  const seedArtistIds = useMemo(
    () =>
      tracks
        .map(
          (t: any) =>
            t?.relationships?.artists?.data?.[0]?.id || t?.attributes?.artistId,
        )
        .filter(Boolean) as string[],
    [tracks],
  )

  if (loading) return <div className="text-obsidian-400">Loading…</div>
  if (!playlist) return <div className="text-obsidian-400">Playlist not found.</div>

  const playFromHere = (startAt = 0) => {
    // Queue from the post-explicit-filter list (see Album.tsx for why).
    const ids: string[] = tracks
      .map((t: any) => t?.attributes?.playParams?.catalogId || t?.id || '')
      .filter(Boolean)
    if (ids.length === 0) return Promise.resolve()
    const artistMap: Record<string, string> = {}
    for (const t of tracks) {
      const tid = t?.attributes?.playParams?.catalogId || t?.id
      const name = t?.attributes?.artistName
      if (tid && typeof name === 'string') artistMap[tid] = name
    }
    return playSongs(ids, startAt, artistMap)
  }

  const onAddSong = async (track: AdderTrack, raw: any) => {
    if (!id) return
    // Optimistic: show it in the list right away.
    setExtraTracks((cur) => (cur.some((t) => t.id === raw.id) ? cur : [...cur, raw]))
    try {
      await addToLibraryPlaylist(id, [track.id])
      toast.info('Added to playlist', `"${track.title}"`)
    } catch (err: any) {
      // Roll back the optimistic row on failure.
      setExtraTracks((cur) => cur.filter((t) => t.id !== raw.id))
      toast.error('Couldn\'t add song', err?.message || String(err))
    }
  }

  const enterEdit = () => {
    setDraftName(displayName)
    setDraftDescription(displayDescription)
    setDraftCover(undefined)
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setDraftCover(undefined)
  }
  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setDraftCover(await resizeImageToDataUrl(file, 600, true))
    } catch (err) {
      console.warn('[playlist] cover resize failed', err)
      toast.error('Couldn\'t load that image', 'Try a different photo.')
    }
  }
  const saveEdit = async () => {
    if (!id) return
    setSavingEdit(true)
    try {
      if (draftCover !== undefined) {
        if (draftCover === null) await removePlaylistCover(id)
        else await setPlaylistCover(id, draftCover)
      }
      // Store name/description only when they differ from Apple's, so we
      // don't permanently shadow the real values with an identical copy.
      const nameOverride =
        draftName.trim() && draftName.trim() !== (attrs.name ?? '') ? draftName : ''
      const descOverride =
        draftDescription.trim() && draftDescription.trim() !== (attrs.description?.short ?? '')
          ? draftDescription
          : ''
      await setPlaylistMeta(id, { name: nameOverride, description: descOverride })
      toast.info('Playlist updated')
      setEditing(false)
      setDraftCover(undefined)
    } catch (err: any) {
      toast.error('Couldn\'t save changes', err?.message || String(err))
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row gap-6 items-end">
        <div className="relative w-56 h-56 flex-shrink-0 group/cover">
          <Artwork src={artLarge} size="xl" rounded="lg" alt={displayName} className="w-56 h-56 shadow-glow" />
          {editing && (
            <>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white opacity-0 group-hover/cover:opacity-100 transition"
                title="Change cover photo"
              >
                <Camera size={26} />
                <span className="text-[12px] font-medium">Change cover</span>
              </button>
              {shownCover && (
                <button
                  onClick={() => setDraftCover(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/55 text-white/85 hover:text-white hover:bg-black/75 opacity-0 group-hover/cover:opacity-100 transition"
                  title="Remove cover"
                >
                  <X size={14} />
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={onCoverChange}
                className="hidden"
              />
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-obsidian-300">Playlist</div>
          {editing ? (
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Playlist name"
              className="mt-1 w-full bg-transparent font-display text-4xl md:text-5xl font-semibold leading-tight text-cream placeholder:text-obsidian-500 outline-none border-b border-white/10 focus:border-white/30 transition"
            />
          ) : (
            <h1 className="mt-1 text-4xl md:text-5xl font-display font-semibold leading-tight">
              {displayName}
            </h1>
          )}
          {editing ? (
            <textarea
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Description — optional"
              rows={2}
              className="mt-2 w-full bg-transparent text-obsidian-200 placeholder:text-obsidian-500 outline-none resize-none max-w-2xl"
            />
          ) : (
            displayDescription && (
              <p className="mt-2 text-obsidian-300 max-w-2xl">{displayDescription}</p>
            )
          )}
          <div className="mt-2 text-obsidian-400 text-sm">{tracks.length} songs · {attrs.curatorName ?? ''}</div>

          {editing ? (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full accent-bg text-obsidian-950 font-semibold hover:brightness-110 disabled:opacity-50 transition shadow-glow"
              >
                <Check size={16} /> {savingEdit ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1] transition"
              >
                Cancel
              </button>
              <span className="text-[11.5px] text-obsidian-400">
                Saved in Çatalify — doesn't change Apple Music
              </span>
            </div>
          ) : (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  // Play = in order. Make the toggle authoritative so the
                  // bottom-bar shuffle icon reflects the choice.
                  setShuffle(false)
                  playFromHere(0).catch(console.error)
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full accent-bg text-obsidian-950 font-semibold hover:brightness-110 transition shadow-glow"
              >
                <Play size={16} fill="currentColor" /> Play
              </button>
              <button
                onClick={() => {
                  setShuffle(true)
                  const startAt =
                    tracks.length > 0 ? Math.floor(Math.random() * tracks.length) : 0
                  playFromHere(startAt).catch(console.error)
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1] transition"
              >
                <Shuffle size={15} /> Shuffle
              </button>
              {editable && (
                <button
                  onClick={enterEdit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1] transition"
                  title="Edit playlist"
                >
                  <Pencil size={15} /> Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 pt-4">
        {tracks.map((t: any, i: number) => (
          <TrackRow
            key={t.id + i}
            index={i}
            track={t}
            onPlay={() => playFromHere(i).catch(console.error)}
          />
        ))}
      </div>

      {/* Add more songs later — only for the user's own library playlists. */}
      {editable && (
        <div className="pt-8 border-t border-white/[0.05]">
          <PlaylistSongAdder
            existingIds={existingIds}
            seedArtistIds={seedArtistIds}
            onAdd={onAddSong}
          />
        </div>
      )}
    </div>
  )
}
