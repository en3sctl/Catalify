import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Play, Shuffle, Plus, Check } from 'lucide-react'
import {
  getAlbum,
  getLibraryAlbum,
  isLibraryId,
  playSongs,
} from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl } from '../utils/format'
import { useExplicitFilter } from '../utils/explicit'
import { usePlayer } from '../store/player'

export function Album() {
  const { id } = useParams<{ id: string }>()
  const [album, setAlbum] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const isLibrary = id ? isLibraryId(id) : false

  useEffect(() => {
    if (!id) return
    setLoading(true)
    const fetcher = isLibrary ? getLibraryAlbum : getAlbum
    fetcher(id)
      .then(setAlbum)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, isLibrary])

  const allTracks = useMemo(() => album?.relationships?.tracks?.data ?? [], [album])
  const tracks = useExplicitFilter<any>(allTracks)
  const attrs = album?.attributes ?? {}
  const artLarge = artworkUrl(attrs.artwork?.url, 600)
  const artistId =
    album?.relationships?.artists?.data?.[0]?.id ||
    (typeof attrs.artistUrl === 'string'
      ? attrs.artistUrl.match(/\/artist\/[^/]+\/(\d+)/)?.[1]
      : undefined)

  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)

  if (loading) {
    return <div className="text-obsidian-400">Loading…</div>
  }
  if (!album) {
    return <div className="text-obsidian-400">Album not found.</div>
  }

  const playFromHere = (startAt = 0) => {
    // Always queue from the visible (post-explicit-filter) list so the
    // user's "Allow explicit" preference holds even on Play / Shuffle
    // taps — the catalog-side play helpers would otherwise re-fetch
    // the album and queue every track regardless.
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
          <div className="text-[12px] uppercase tracking-widest text-obsidian-300">{attrs.recordLabel ? 'Album' : 'Album'}</div>
          <h1 className="mt-1 text-4xl md:text-5xl font-display font-semibold leading-tight">{attrs.name}</h1>
          <div className="mt-2 text-obsidian-300">
            {artistId ? (
              <Link
                to={`/artist/${artistId}`}
                className="hover:text-cream hover:underline"
              >
                {attrs.artistName}
              </Link>
            ) : (
              attrs.artistName
            )}
            {' · '}
            {attrs.releaseDate?.slice(0, 4)} · {tracks.length} songs
          </div>
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
            <LibraryToggle albumId={album.id} albumSnapshot={album} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 pt-4">
        {tracks.map((t: any, i: number) => (
          <TrackRow
            key={t.id}
            index={i}
            track={t}
            showArt={false}
            showAlbum={false}
            onPlay={() => playFromHere(i).catch(console.error)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * "Add to Library" / "Saved" pill. Library albums (already in library
 * by definition) hide it; for catalog albums it flips state optimistically
 * and surfaces a toast on failure / re-press.
 */
function LibraryToggle({
  albumId,
  albumSnapshot,
}: {
  albumId: string
  albumSnapshot: any
}) {
  const saved = usePlayer((s) => !!s.librarySaved.albums[albumId])
  const toggle = usePlayer((s) => s.toggleLibraryAlbum)
  // Library-side IDs are already in the library — no point offering to
  // re-add. Hide rather than disable so the row stays clean.
  if (/^[ipl]\./i.test(albumId)) return null
  return (
    <button
      onClick={() => toggle(albumId, albumSnapshot)}
      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1] transition"
      title={saved ? 'In your library' : 'Add to library'}
    >
      {saved ? <Check size={15} /> : <Plus size={15} />}
      {saved ? 'Saved' : 'Add to library'}
    </button>
  )
}
