import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Play, Shuffle } from 'lucide-react'
import {
  getAlbum,
  getLibraryAlbum,
  isLibraryId,
  playAlbum,
  playLibraryAlbum,
} from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl } from '../utils/format'
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

  const tracks = useMemo(() => album?.relationships?.tracks?.data ?? [], [album])
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

  const playFromHere = (startAt = 0) =>
    isLibrary
      ? playLibraryAlbum(album.id, startAt)
      : playAlbum(album.id, startAt)

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
