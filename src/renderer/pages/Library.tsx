import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Search as SearchIcon, X } from 'lucide-react'
import { getLibraryAlbums, getLibraryPlaylists, getLibrarySongs, playSongs } from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl, clsx } from '../utils/format'
import { useExplicitFilter } from '../utils/explicit'
import { usePlayer } from '../store/player'

type Tab = 'playlists' | 'albums' | 'songs'
type SortMode = 'recent' | 'oldest' | 'alpha'

export function Library() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('playlists')
  const [playlists, setPlaylists] = useState<any[]>([])
  const [albums, setAlbums] = useState<any[]>([])
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')

  const refresh = useCallback(async (mode: 'initial' | 'manual' = 'initial') => {
    if (mode === 'manual') setRefreshing(true)
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
    const pls = get<any[]>(0, [])
    const albumsData = get<any[]>(1, [])
    const sgs = get<any[]>(2, [])

    // Merge in optimistic albums — ones the user just added in Çatalify
    // that Apple's library API hasn't reindexed yet (5–15min lag).
    // After the merge, drop any optimistic entry Apple has started
    // returning, so the cache doesn't grow forever.
    const optimistic =
      (await window.bombo.store.get<any[]>('optimisticLibraryAlbums')) || []
    const appleIds = new Set(
      albumsData
        .map((a: any) => a?.attributes?.playParams?.catalogId || a?.id)
        .filter(Boolean)
        .map(String),
    )
    const stillPending = optimistic.filter(
      (a: any) =>
        !appleIds.has(String(a?.attributes?.playParams?.catalogId || a?.id)),
    )
    if (stillPending.length !== optimistic.length) {
      window.bombo.store.set('optimisticLibraryAlbums', stillPending)
    }
    const mergedAlbums = [...stillPending, ...albumsData]

    setPlaylists(pls)
    setAlbums(mergedAlbums)
    setSongs(sgs)
    // Mirror Apple's "albums in library" set into our store so the
    // Album page's "Saved" badge reflects whatever was true on Apple's
    // side just now. Include optimistic IDs so the badge sticks even
    // before Apple's CDN catches up.
    const savedAlbumMap: Record<string, boolean> = {}
    for (const a of mergedAlbums) {
      const cid = a?.attributes?.playParams?.catalogId || a?.id
      if (cid) savedAlbumMap[String(cid)] = true
    }
    const setLibrarySaved = usePlayer.getState().setLibrarySaved
    setLibrarySaved('albums', savedAlbumMap)
    window.bombo.store.set('librarySaved', {
      ...usePlayer.getState().librarySaved,
      albums: savedAlbumMap,
    })
    setLoading(false)
    if (mode === 'manual') setRefreshing(false)
  }, [])

  useEffect(() => { refresh('initial') }, [refresh])

  // Apply the explicit-content filter once at the top, so search /
  // sort / queue all run on the same already-cleaned set.
  const visiblePlaylists = useExplicitFilter<any>(playlists)
  const visibleAlbums = useExplicitFilter<any>(albums)
  const visibleSongs = useExplicitFilter<any>(songs)

  // Filter + sort the active tab's items based on the toolbar.
  const filtered = useMemo(() => {
    const source =
      tab === 'playlists' ? visiblePlaylists : tab === 'albums' ? visibleAlbums : visibleSongs
    const q = query.trim().toLowerCase()
    const matchesQuery = (item: any) => {
      if (!q) return true
      const a = item?.attributes ?? {}
      const haystack = [
        a.name,
        a.artistName,
        a.curatorName,
        a.albumName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    }
    const sortKey = (item: any): number | string => {
      const a = item?.attributes ?? {}
      if (sort === 'alpha') return (a.name ?? '').toLowerCase()
      // Apple library responses carry `dateAdded` for library-relative
      // recency. Fall back to releaseDate for catalog-only items, and
      // 0 for anything missing both — those sort to the tail naturally.
      const raw = a.dateAdded || a.lastModifiedDate || a.releaseDate || 0
      const t = typeof raw === 'string' ? Date.parse(raw) : Number(raw)
      return Number.isFinite(t) ? t : 0
    }
    const arr = source.filter(matchesQuery).slice()
    arr.sort((a, b) => {
      const ka = sortKey(a)
      const kb = sortKey(b)
      if (sort === 'alpha') return String(ka).localeCompare(String(kb))
      // 'recent' = newest first, 'oldest' = oldest first
      const cmp = (kb as number) - (ka as number)
      return sort === 'recent' ? cmp : -cmp
    })
    return arr
  }, [tab, visiblePlaylists, visibleAlbums, visibleSongs, query, sort])

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="text-4xl font-display leading-tight">Your Library</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refresh('manual')}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-cream/85 text-[12.5px] transition disabled:opacity-60"
            title="Refresh from Apple Music"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
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

      {/* Search + sort toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] focus-within:border-white/[0.14] transition">
          <SearchIcon size={15} className="text-obsidian-300 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="flex-1 bg-transparent outline-none text-[13px] text-cream placeholder:text-obsidian-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-obsidian-400 hover:text-cream"
              title="Clear"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1 liquid-glass rounded-full p-1">
          {([
            { v: 'recent', label: 'Recent' },
            { v: 'oldest', label: 'Oldest' },
            { v: 'alpha', label: 'A–Z' },
          ] as { v: SortMode; label: string }[]).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setSort(v)}
              className={clsx(
                'px-3 py-1 rounded-full text-[12px] font-medium transition',
                sort === v ? 'accent-bg text-dusk' : 'text-obsidian-300 hover:text-cream',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-obsidian-800/60 animate-pulse" />
          ))}
        </div>
      ) : tab === 'songs' ? (
        filtered.length === 0 ? (
          <div className="text-obsidian-400 text-sm italic">
            {query ? `No songs match "${query}".` : 'Nothing here yet.'}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((s, i) => (
              <TrackRow
                key={s.id}
                index={i}
                track={s}
                onPlay={() =>
                  playSongs(
                    filtered.map((x: any) => x.attributes?.playParams?.catalogId || x.id),
                    i,
                  ).catch(console.error)
                }
              />
            ))}
          </div>
        )
      ) : (
        <Grid items={filtered} kind={tab === 'playlists' ? 'playlist' : 'album'} query={query} />
      )}
    </div>
  )
}

function Grid({
  items,
  kind,
  query,
}: {
  items: any[]
  kind: 'album' | 'playlist'
  query: string
}) {
  if (items.length === 0) {
    return (
      <div className="text-obsidian-400 text-sm italic">
        {query ? `No ${kind}s match "${query}".` : 'Nothing here yet.'}
      </div>
    )
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
