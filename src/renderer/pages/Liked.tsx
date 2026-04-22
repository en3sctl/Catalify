import { useEffect, useMemo, useState } from 'react'
import { Heart, Play, Shuffle } from 'lucide-react'
import { usePlayer } from '../store/player'
import { getCatalogSongsByIds, playSongs } from '../utils/musickit-api'
import { TrackRow } from '../components/TrackRow'

export function Liked() {
  const likedIds = usePlayer((s) => s.likedIds)
  const setShuffle = usePlayer((s) => s.setShuffle)
  const ids = useMemo(() => Object.keys(likedIds), [likedIds])
  const [tracks, setTracks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ids.length === 0) { setTracks([]); return }
    setLoading(true)
    getCatalogSongsByIds(ids)
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false))
  }, [ids.join(',')])

  const playAll = () => {
    if (tracks.length === 0) return
    playSongs(tracks.map((t) => t.id), 0).catch(console.error)
  }
  const shuffleAll = async () => {
    if (tracks.length === 0) return
    try {
      setShuffle(true)
      await playSongs(tracks.map((t) => t.id), 0)
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-end gap-6 pt-2">
        <div
          className="w-48 h-48 rounded-2xl shadow-glow flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--accent) / 0.35), rgb(var(--accent-soft) / 0.2))',
          }}
        >
          <Heart size={62} fill="currentColor" className="accent-text" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-obsidian-300">Playlist</div>
          <h1 className="mt-1 text-5xl font-display leading-tight">Liked songs</h1>
          <div className="mt-2 text-obsidian-300">{ids.length} {ids.length === 1 ? 'song' : 'songs'}</div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={playAll}
              disabled={tracks.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full accent-bg text-obsidian-950 font-semibold hover:brightness-110 transition shadow-glow disabled:opacity-40"
            >
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button
              onClick={shuffleAll}
              disabled={tracks.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] text-white hover:bg-white/[0.1] transition disabled:opacity-40"
            >
              <Shuffle size={15} /> Shuffle
            </button>
          </div>
        </div>
      </div>

      {ids.length === 0 && (
        <div className="text-obsidian-400 italic py-10 text-center">
          Tap the heart on a track to add it here.
        </div>
      )}
      {loading && ids.length > 0 && (
        <div className="text-obsidian-400 italic">Loading…</div>
      )}

      <div className="flex flex-col gap-0.5 pt-2">
        {tracks.map((t, i) => (
          <TrackRow
            key={t.id}
            index={i}
            track={t}
            onPlay={() => playSongs(tracks.map((x) => x.id), i).catch(console.error)}
          />
        ))}
      </div>
    </div>
  )
}
