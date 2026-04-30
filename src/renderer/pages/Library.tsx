import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { getLibraryAlbums, getLibraryPlaylists, getLibrarySongs, playSongs } from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl, clsx } from '../utils/format'

type Tab = 'playlists' | 'albums' | 'songs'

export function Library() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('playlists')
  const [playlists, setPlaylists] = useState<any[]>([])
  const [albums, setAlbums] = useState<any[]>([])
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    // allSettled — Apple Music's per-endpoint failures shouldn't blank
    // the whole library. Songs sometimes 403s in regions where Albums
    // and Playlists succeed; before this, that one rejection caused all
    // three lists to stay empty (Promise.all short-circuits on reject).
    const results = await Promise.allSettled([
      getLibraryPlaylists(100),
      getLibraryAlbums(100),
      getLibrarySongs(200),
    ])
    const get = <T,>(i: number, fallback: T): T =>
      results[i].status === 'fulfilled'
        ? ((results[i] as PromiseFulfilledResult<T>).value ?? fallback)
        : fallback
    for (const r of results) {
      if (r.status === 'rejected') console.warn('[library] fetch failed', r.reason)
    }
    setPlaylists(get<any[]>(0, []))
    setAlbums(get<any[]>(1, []))
    setSongs(get<any[]>(2, []))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="text-4xl font-display leading-tight">Your Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/playlist/new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full liquid-glass text-[12.5px] font-medium hover:brightness-125 transition"
            title="Create a new playlist"
          >
            <Plus size={14} /> New playlist
          </button>
          <div className="flex gap-1 liquid-glass rounded-full p-1">
            {(['playlists', 'albums', 'songs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'px-4 py-1.5 rounded-full text-[13px] font-medium capitalize transition',
                  tab === t ? 'accent-bg text-dusk' : 'text-obsidian-300 hover:text-cream',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-obsidian-800/60 animate-pulse" />
          ))}
        </div>
      ) : tab === 'playlists' ? (
        <Grid items={playlists} kind="playlist" />
      ) : tab === 'albums' ? (
        <Grid items={albums} kind="album" />
      ) : (
        <div className="flex flex-col gap-0.5">
          {songs.map((s, i) => (
            <TrackRow
              key={s.id}
              index={i}
              track={s}
              onPlay={() =>
                playSongs(
                  songs.map((x: any) => x.attributes?.playParams?.catalogId || x.id),
                  i,
                ).catch(console.error)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Grid({ items, kind }: { items: any[]; kind: 'album' | 'playlist' }) {
  if (items.length === 0) {
    return <div className="text-obsidian-400 text-sm italic">Nothing here yet.</div>
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((item) => {
        const attrs = item.attributes ?? {}
        const art = artworkUrl(attrs.artwork?.url, 400)
        // Library items use catalog IDs for navigation when available
        const catalogId = attrs.playParams?.catalogId || item.id
        const to = kind === 'album' ? `/album/${catalogId}` : `/playlist/${catalogId}`
        return (
          <Link
            key={item.id}
            to={to}
            className="group block rounded-xl p-3 hover:bg-white/[0.04] transition"
          >
            <Artwork src={art} size="hero" rounded="lg" alt={attrs.name} />
            <div className="mt-3 truncate text-[13.5px] font-semibold text-white">{attrs.name}</div>
            <div className="truncate text-[12px] text-obsidian-300">
              {attrs.artistName ?? attrs.curatorName ?? ''}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
