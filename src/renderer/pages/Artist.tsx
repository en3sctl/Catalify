import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Play, Shuffle } from 'lucide-react'
import { getArtist, playSongs, playAlbum } from '../utils/musickit-api'
import { TrackRow } from '../components/TrackRow'
import { Artwork } from '../components/Artwork'
import { MediaCard } from '../components/MediaCard'
import { Rail } from '../components/Rail'
import { artworkUrl } from '../utils/format'
import { usePlayer } from '../store/player'

export function Artist() {
  const { id } = useParams<{ id: string }>()
  const [artist, setArtist] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getArtist(id).then(setArtist).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-obsidian-300">Loading…</div>
  if (!artist) return <div className="text-obsidian-300">Artist not found.</div>

  const attrs = artist.attributes ?? {}
  const art = artworkUrl(attrs.artwork?.url, 800)
  const topSongs: any[] = artist.views?.['top-songs']?.data ?? []
  const albums: any[] = artist.views?.['full-albums']?.data ?? artist.views?.['featured-albums']?.data ?? []
  const similar: any[] = artist.views?.['similar-artists']?.data ?? []
  const setShuffle = usePlayer((s) => s.setShuffle)

  const playTop = () => {
    if (topSongs.length === 0) return
    playSongs(topSongs.map((s) => s.id), 0).catch(console.error)
  }
  const shuffleTop = async () => {
    if (topSongs.length === 0) return
    try {
      setShuffle(true)
      await playSongs(topSongs.map((s) => s.id), 0)
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="relative flex flex-col md:flex-row gap-6 items-end pt-2">
        <div
          className="absolute -inset-x-8 -top-8 h-[320px] pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(600px 260px at 20% 50%, rgb(var(--accent) / 0.22), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <Artwork
          src={art}
          size="xl"
          rounded="full"
          alt={attrs.name}
          className="w-48 h-48 shadow-glow"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-obsidian-300">Artist</div>
          <h1 className="mt-1 text-5xl md:text-6xl font-display leading-tight">{attrs.name}</h1>
          {attrs.genreNames?.length > 0 && (
            <div className="mt-2 text-obsidian-300 text-sm">{attrs.genreNames.slice(0, 3).join(' · ')}</div>
          )}
          <div className="mt-4 flex gap-3">
            <button
              onClick={playTop}
              disabled={topSongs.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full accent-bg text-dusk font-semibold hover:brightness-110 transition shadow-glow disabled:opacity-50"
            >
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button
              onClick={shuffleTop}
              disabled={topSongs.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-cream hover:bg-white/[0.1] transition disabled:opacity-50"
            >
              <Shuffle size={15} /> Shuffle
            </button>
          </div>
        </div>
      </div>

      {topSongs.length > 0 && (
        <section>
          <h2 className="text-[22px] font-display mb-3">Top songs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {topSongs.slice(0, 10).map((s, i) => (
              <TrackRow
                key={s.id}
                index={i}
                track={s}
                onPlay={() => playSongs(topSongs.map((x) => x.id), i).catch(console.error)}
              />
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <Rail title="Albums" widthClass="w-48">
          {albums.slice(0, 16).map((a) => (
            <MediaCard key={a.id} item={a} onPlay={() => playAlbum(a.id).catch(console.error)} />
          ))}
        </Rail>
      )}

      {similar.length > 0 && (
        <Rail title="Similar artists" widthClass="w-44">
          {similar.slice(0, 12).map((a) => (
            <Link key={a.id} to={`/artist/${a.id}`} className="block group rounded-xl p-2 hover:bg-white/[0.04] transition">
              <Artwork src={artworkUrl(a.attributes?.artwork?.url, 300)} size="hero" rounded="full" alt={a.attributes?.name} />
              <div className="mt-2 text-center truncate text-[13px] font-semibold">{a.attributes?.name}</div>
            </Link>
          ))}
        </Rail>
      )}
    </div>
  )
}
