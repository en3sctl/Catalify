import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Shuffle } from 'lucide-react'
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
import { useLocalPlaylistCover } from '../utils/playlist-covers'
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

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setExtraTracks([])
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
  // A locally-uploaded cover (set on the create page) wins over Apple's art.
  const localCover = useLocalPlaylistCover(id)
  const artLarge = localCover ?? artworkUrl(attrs.artwork?.url, 600)

  // Only the user's own library playlists can take new songs. Apple marks
  // these with attributes.canEdit; treat a missing flag on a library id as
  // editable (user-created playlists predate the flag on some storefronts).
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

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row gap-6 items-end">
        <Artwork src={artLarge} size="xl" rounded="lg" alt={attrs.name} className="w-56 h-56 shadow-glow" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-obsidian-300">Playlist</div>
          <h1 className="mt-1 text-4xl md:text-5xl font-display font-semibold leading-tight">{attrs.name}</h1>
          {attrs.description?.short && (
            <p className="mt-2 text-obsidian-300 max-w-2xl">{attrs.description.short}</p>
          )}
          <div className="mt-2 text-obsidian-400 text-sm">{tracks.length} songs · {attrs.curatorName ?? ''}</div>
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
                // Shuffle = always shuffle, starting on a RANDOM track.
                setShuffle(true)
                const startAt =
                  tracks.length > 0 ? Math.floor(Math.random() * tracks.length) : 0
                playFromHere(startAt).catch(console.error)
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1] transition"
            >
              <Shuffle size={15} /> Shuffle
            </button>
          </div>
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
