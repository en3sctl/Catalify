import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Shuffle } from 'lucide-react'
import { SharedPlaylist as SP, getUserPlaylists } from '../utils/social-api'
import { getCatalogSongsByIds, playSongs } from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl } from '../utils/format'
import { usePlayer } from '../store/player'

/** A friend's shared playlist, opened from their profile — resolves the
 *  carried catalog track ids into real songs so it's browsable + playable. */
export function SharedPlaylist() {
  const { userId, pid } = useParams<{ userId: string; pid: string }>()
  const [pl, setPl] = useState<SP | null>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const setShuffle = usePlayer((s) => s.setShuffle)

  useEffect(() => {
    if (!userId || !pid) return
    setLoading(true)
    const decoded = decodeURIComponent(pid)
    getUserPlaylists(Number(userId))
      .then(async (list) => {
        const found = list.find((p) => p.applePlaylistId === decoded) || null
        setPl(found)
        if (found && found.trackIds.length) {
          const ids = found.trackIds.filter((id) => id && !/^i\./i.test(id))
          const songs = await getCatalogSongsByIds(ids).catch(() => [])
          setTracks(songs || [])
        } else {
          setTracks([])
        }
      })
      .finally(() => setLoading(false))
  }, [userId, pid])

  if (loading) return <div className="text-obsidian-400">Loading…</div>
  if (!pl) return <div className="text-obsidian-400">Playlist not found.</div>

  const artLarge = artworkUrl(pl.artUrl ?? undefined, 600)
  const playFrom = (startAt = 0) => {
    const ids = tracks.map((t) => t?.attributes?.playParams?.catalogId || t.id).filter(Boolean)
    if (ids.length > 0) playSongs(ids, startAt).catch(console.error)
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row gap-6 items-end">
        <Artwork src={artLarge} size="xl" rounded="lg" alt={pl.title} className="w-56 h-56 shadow-glow" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-obsidian-300">Shared playlist</div>
          <h1 className="mt-1 text-4xl md:text-5xl font-display font-semibold leading-tight">{pl.title || 'Playlist'}</h1>
          <div className="mt-2 text-obsidian-400 text-sm">{tracks.length} songs</div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                setShuffle(false)
                playFrom(0)
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full accent-bg text-obsidian-950 font-semibold hover:brightness-110 transition shadow-glow"
            >
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => {
                setShuffle(true)
                playFrom(tracks.length > 0 ? Math.floor(Math.random() * tracks.length) : 0)
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
          <TrackRow key={t.id + i} index={i} track={t} onPlay={() => playFrom(i)} />
        ))}
      </div>
    </div>
  )
}
