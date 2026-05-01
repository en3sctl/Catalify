import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Shuffle } from 'lucide-react'
import {
  getLibraryPlaylist,
  getPlaylist,
  isLibraryId,
  playSongs,
} from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl } from '../utils/format'
import { useExplicitFilter } from '../utils/explicit'
import { usePlayer } from '../store/player'

export function Playlist() {
  const { id } = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)

  // Library playlists (user-created, "p.xxx" / "pl.u-xxx") only resolve
  // through the library endpoint — the catalog endpoint 404s on them.
  const isLibrary = id ? isLibraryId(id) : false

  useEffect(() => {
    if (!id) return
    setLoading(true)
    const fetcher = isLibrary ? getLibraryPlaylist : getPlaylist
    fetcher(id)
      .then(setPlaylist)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, isLibrary])

  const allTracks = useMemo(() => playlist?.relationships?.tracks?.data ?? [], [playlist])
  const tracks = useExplicitFilter<any>(allTracks)
  const attrs = playlist?.attributes ?? {}
  const artLarge = artworkUrl(attrs.artwork?.url, 600)

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
              onClick={() => playFromHere(0).catch(console.error)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full accent-bg text-obsidian-950 font-semibold hover:brightness-110 transition shadow-glow"
            >
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button
              onClick={async () => {
                toggleShuffle()
                try {
                  await playFromHere(0)
                } catch (e) { console.error(e) }
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
    </div>
  )
}
