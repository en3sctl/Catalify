import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Heart,
  Play,
  Radio,
  Disc3,
  Library as LibraryIcon,
  Sparkles,
  Search as SearchIcon,
  Clock,
  X,
  RefreshCw,
} from 'lucide-react'
import {
  getCharts,
  getHeavyRotation,
  getRecentlyPlayed,
  getRotatingRecommendations,
  getLibraryPlaylists,
  getLibraryRecentlyAdded,
  getLibrarySongs,
  playAlbum,
  playPlaylist,
  playSongs,
} from '../utils/musickit-api'
import { Rail } from '../components/Rail'
import { MediaCard } from '../components/MediaCard'
import { usePlayer } from '../store/player'
import { artworkUrl, clsx } from '../utils/format'
import { TrackRow } from '../components/TrackRow'

interface HomeData {
  recent: any[]
  rotation: any[]
  recommendations: any[]
  playlists: any[]
  recentlyAdded: any[]
  librarySongs: any[]
  chartSongs: any[]
  chartAlbums: any[]
  chartPlaylists: any[]
}

const EMPTY: HomeData = {
  recent: [],
  rotation: [],
  recommendations: [],
  playlists: [],
  recentlyAdded: [],
  librarySongs: [],
  chartSongs: [],
  chartAlbums: [],
  chartPlaylists: [],
}

// 30 minutes — mirrors Apple Music's web client cadence. Charts move
// throughout the day, recommendations rotate slower; both are cheap.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000

export function Home() {
  const [data, setData] = useState<HomeData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState<number>(0)

  const loadAll = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true)
    const results = await Promise.allSettled([
      getRecentlyPlayed(20),
      getHeavyRotation(12),
      getRotatingRecommendations(12),
      getLibraryPlaylists(12),
      getLibraryRecentlyAdded(12),
      getLibrarySongs(30),
      getCharts(['songs', 'albums', 'playlists'], 20),
    ])
    const get = <T,>(i: number, fallback: T): T =>
      results[i].status === 'fulfilled' ? ((results[i] as any).value ?? fallback) : fallback
    const charts = get(6, { songs: [], albums: [], playlists: [] }) as {
      songs: any[]
      albums: any[]
      playlists: any[]
    }
    setData({
      recent: get(0, []),
      rotation: get(1, []),
      recommendations: get(2, []),
      playlists: get(3, []),
      recentlyAdded: get(4, []),
      librarySongs: get(5, []),
      chartSongs: charts.songs,
      chartAlbums: charts.albums,
      chartPlaylists: charts.playlists,
    })
    setLastLoadedAt(Date.now())
    if (mode === 'initial') setLoading(false)
    if (mode === 'refresh') setRefreshing(false)
  }, [])

  useEffect(() => {
    loadAll('initial').catch(console.error)
  }, [loadAll])

  // Auto-refresh: when the user comes back to the app (or unhides the
  // tab) after a long enough gap, pull fresh charts/recommendations.
  // Also a coarse 30-minute fallback while the app stays open.
  useEffect(() => {
    const maybeRefresh = () => {
      if (Date.now() - lastLoadedAt > REFRESH_INTERVAL_MS) {
        loadAll('refresh').catch(console.error)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeRefresh()
    }
    window.addEventListener('focus', maybeRefresh)
    document.addEventListener('visibilitychange', onVisibility)
    const id = window.setInterval(maybeRefresh, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', maybeRefresh)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(id)
    }
  }, [lastLoadedAt, loadAll])

  return (
    <div className="space-y-10 pb-16">
      <HomeSearchBar />
      <Hero
        featured={data.recent[0]}
        onRefresh={() => loadAll('refresh')}
        refreshing={refreshing}
      />

      <QuickShortcuts />

      {data.recommendations.length > 0 && (
        <Rail
          title="Made for you"
          subtitle="Apple Music picks based on what you play"
          widthClass="w-48"
        >
          {flattenRecommendations(data.recommendations)
            .slice(0, 16)
            .map((item) => (
              <MediaCard
                key={item.id + (item.type ?? '')}
                item={item}
                onPlay={() => playItem(item)}
              />
            ))}
        </Rail>
      )}

      {data.chartSongs.length > 0 && (
        <section>
          <SectionHeader
            title="Top 100 right now"
            subtitle="What's charting on Apple Music today"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {data.chartSongs.slice(0, 10).map((s, i) => (
              <TrackRow
                key={s.id}
                index={i}
                track={s}
                onPlay={() =>
                  playSongs(
                    data.chartSongs.map((x: any) => x.id),
                    i,
                  ).catch(console.error)
                }
              />
            ))}
          </div>
        </section>
      )}

      {data.chartAlbums.length > 0 && (
        <Rail
          title="Trending albums"
          subtitle="Most-played in your storefront"
          widthClass="w-48"
        >
          {data.chartAlbums.slice(0, 14).map((item) => (
            <MediaCard
              key={item.id + (item.type ?? '')}
              item={item}
              onPlay={() => playItem(item)}
            />
          ))}
        </Rail>
      )}

      {data.librarySongs.length > 0 && (
        <section>
          <SectionHeader
            title="From your library"
            subtitle="Songs you've saved in Apple Music"
            action={
              <Link to="/library" className="text-[12px] text-obsidian-300 hover:text-cream">
                See all →
              </Link>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {data.librarySongs.slice(0, 10).map((s, i) => (
              <TrackRow
                key={s.id}
                index={i}
                track={s}
                onPlay={() =>
                  playSongs(
                    data.librarySongs.map(
                      (x: any) => x.attributes?.playParams?.catalogId || x.id,
                    ),
                    i,
                  ).catch(console.error)
                }
              />
            ))}
          </div>
        </section>
      )}

      {data.recent.length > 0 && (
        <Rail title="Recently played" subtitle="Jump right back in" widthClass="w-48">
          {data.recent.slice(0, 12).map((item) => (
            <MediaCard
              key={item.id + (item.type ?? '')}
              item={item}
              onPlay={() => playItem(item)}
            />
          ))}
        </Rail>
      )}

      {data.chartPlaylists.length > 0 && (
        <Rail
          title="Editor's picks"
          subtitle="Featured playlists right now"
          widthClass="w-48"
        >
          {data.chartPlaylists.slice(0, 14).map((item) => (
            <MediaCard
              key={item.id + (item.type ?? '')}
              item={item}
              onPlay={() => playItem(item)}
            />
          ))}
        </Rail>
      )}

      {data.playlists.length > 0 && (
        <Rail
          title="Your playlists"
          subtitle="From your Apple Music library"
          widthClass="w-48"
          action={
            <Link to="/library" className="text-[12px] text-obsidian-300 hover:text-cream">
              See all →
            </Link>
          }
        >
          {data.playlists.slice(0, 12).map((item) => (
            <MediaCard key={item.id} item={item} onPlay={() => playItem(item)} />
          ))}
        </Rail>
      )}

      {data.rotation.length > 0 && (
        <Rail title="On repeat" subtitle="Your heavy rotation" widthClass="w-48">
          {data.rotation.slice(0, 12).map((item) => (
            <MediaCard
              key={item.id + (item.type ?? '')}
              item={item}
              onPlay={() => playItem(item)}
            />
          ))}
        </Rail>
      )}

      {data.recentlyAdded.length > 0 && (
        <Rail title="Recently added" subtitle="Fresh in your library" widthClass="w-48">
          {data.recentlyAdded.slice(0, 12).map((item) => (
            <MediaCard key={item.id} item={item} onPlay={() => playItem(item)} />
          ))}
        </Rail>
      )}

      {loading && <Skeleton />}
    </div>
  )
}

/* ── Home search bar ─────────────────────────────────────────── */

/**
 * Spotify-style inline search that sits at the top of Home. Typing +
 * Enter navigates to `/search?q=...` — the real results page. Focusing
 * without typing reveals recent searches; clicking one navigates too.
 * This keeps the sidebar's Search tab as a destination for power users
 * while giving the "pull to search" affordance that casual listeners
 * expect on a home screen.
 */
function HomeSearchBar() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.bombo.store
      .get<string[]>('recentSearches')
      .then((v) => setRecent(Array.isArray(v) ? v : []))
  }, [])

  // Collapse the dropdown on outside click.
  useEffect(() => {
    if (!focused) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [focused])

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    setFocused(false)
  }

  const clearRecent = () => {
    setRecent([])
    window.bombo.store.set('recentSearches', [])
  }

  const hasSuggestions = focused && recent.length > 0

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={clsx(
          'flex items-center gap-3 rounded-2xl px-4 py-3 border transition backdrop-blur-xl',
          'bg-white/[0.04] border-white/[0.06]',
          focused && 'border-white/[0.14] bg-white/[0.06]',
        )}
      >
        <SearchIcon size={17} className="text-obsidian-300 flex-shrink-0" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(term)
            if (e.key === 'Escape') setFocused(false)
          }}
          placeholder="Search songs, albums, artists…"
          className="flex-1 bg-transparent outline-none text-[14px] text-cream placeholder:text-obsidian-400"
        />
        {term && (
          <button
            onClick={() => setTerm('')}
            className="text-obsidian-400 hover:text-white transition"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {hasSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl overflow-hidden border border-white/[0.08] bg-[rgba(14,10,22,0.96)] backdrop-blur-xl shadow-[0_30px_60px_-24px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
              <span className="text-[11px] uppercase tracking-[0.2em] text-obsidian-400 font-medium">
                Recent
              </span>
              <button
                onClick={clearRecent}
                className="text-[11px] text-obsidian-400 hover:text-white transition"
              >
                Clear
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {recent.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-[13px] text-cream hover:bg-white/[0.05] transition"
                >
                  <Clock size={14} className="text-obsidian-400 flex-shrink-0" />
                  <span className="truncate">{q}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Section header ──────────────────────────────────────────── */

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="font-display text-[22px] font-bold tracking-tight leading-none">
          {title}
        </h2>
        {subtitle && <p className="text-[12.5px] text-obsidian-300 mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ── Hero ────────────────────────────────────────────────────── */

function Hero({
  featured,
  onRefresh,
  refreshing,
}: {
  featured?: any
  onRefresh: () => void
  refreshing: boolean
}) {
  const nowPlaying = usePlayer((s) => s.nowPlaying)
  const isPlaying = usePlayer((s) => s.isPlaying)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 5) return 'Late night'
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // Prefer "now playing" as the hero context, fall back to last played.
  const heroItem = nowPlaying ?? (featured
    ? {
        id: featured?.attributes?.playParams?.catalogId || featured?.id,
        title: featured?.attributes?.name,
        artistName:
          featured?.attributes?.artistName ?? featured?.attributes?.curatorName ?? '',
        artworkUrl: artworkUrl(featured?.attributes?.artwork?.url, 900),
      }
    : null)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[28px] h-[300px] md:h-[340px] liquid-glass-strong"
    >
      {/* Subtle accent wash on top of the page-wide BackdropAura — keeps
          the hero feeling like its own surface without re-blurring the art. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(700px 320px at 80% 20%, rgb(var(--accent) / 0.18), transparent 70%), linear-gradient(180deg, rgba(10,8,18,0) 40%, rgba(10,8,18,0.35) 100%)',
        }}
      />

      {/* Refresh — pulls fresh charts/recommendations on demand */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh recommendations"
        className="absolute top-5 right-5 z-[2] w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white bg-white/[0.05] hover:bg-white/[0.12] backdrop-blur-xl border border-white/[0.08] transition disabled:opacity-50"
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
      </button>

      {/* Content */}
      <div className="relative h-full z-[1] flex items-center justify-between gap-8 p-8 md:p-12">
        <div className="flex-1 min-w-0 max-w-xl">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] accent-text font-medium">
            <Sparkles size={12} />
            <span>{greeting}</span>
          </div>
          <h1 className="mt-3 font-display text-[44px] md:text-[58px] font-bold leading-[0.95] tracking-[-0.035em]">
            {nowPlaying ? 'Keep the flow going.' : heroItem ? 'Pick up where\nyou left off.' : 'What will you\nplay today?'}
          </h1>

          {heroItem && (
            <Link
              to={nowPlaying ? '/now-playing' : '#'}
              onClick={(e) => {
                if (!nowPlaying && featured) {
                  e.preventDefault()
                  playItem(featured)
                }
              }}
              className="group/card mt-7 inline-flex items-center gap-4 pr-5 pl-2 py-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.08] transition max-w-full"
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)]">
                {heroItem.artworkUrl && (
                  <img
                    src={heroItem.artworkUrl}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                )}
                {!nowPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/card:opacity-100 transition">
                    <Play size={16} fill="currentColor" className="text-white translate-x-[1px]" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] uppercase tracking-widest text-cream/55">
                  {nowPlaying ? (isPlaying ? 'Now playing' : 'Paused') : 'Resume'}
                </div>
                <div className="truncate text-[14.5px] font-semibold text-cream">
                  {heroItem.title}
                </div>
                <div className="truncate text-[12.5px] text-cream/65">
                  {heroItem.artistName}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </motion.section>
  )
}

/* ── Quick shortcuts ─────────────────────────────────────────── */

function QuickShortcuts() {
  const likedCount = usePlayer((s) => Object.keys(s.likedIds).length)
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <ShortcutTile
        to="/liked"
        icon={<Heart size={16} fill="currentColor" />}
        title="Liked"
        subtitle={`${likedCount} ${likedCount === 1 ? 'track' : 'tracks'}`}
      />
      <ShortcutTile
        to="/library"
        icon={<LibraryIcon size={16} />}
        title="Library"
        subtitle="Albums & playlists"
      />
      <ShortcutTile
        to="/radio"
        icon={<Radio size={16} />}
        title="Radio"
        subtitle="Live stations"
      />
      <ShortcutTile
        to="/search"
        icon={<Disc3 size={16} />}
        title="Explore"
        subtitle="Search catalog"
      />
    </div>
  )
}

function ShortcutTile({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'group flex items-center gap-3 px-4 py-3 rounded-2xl transition',
        'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.09]',
        'backdrop-blur-xl',
      )}
    >
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] text-cream flex items-center justify-center flex-shrink-0 group-hover:bg-white/[0.1] group-hover:accent-text transition">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-cream truncate">{title}</div>
        <div className="text-[11.5px] text-obsidian-300 truncate">{subtitle}</div>
      </div>
    </Link>
  )
}

/* ── Loading ─────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-6 w-40 bg-white/[0.04] rounded animate-pulse mb-3" />
          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="w-48 h-60 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────── */

function playItem(item: any) {
  const type = String(item?.type ?? '')
  const id = item?.attributes?.playParams?.catalogId || item?.id
  if (type.includes('album')) playAlbum(id).catch(console.error)
  else if (type.includes('playlist')) playPlaylist(id).catch(console.error)
  else if (type.includes('song')) playSongs([id]).catch(console.error)
}

function flattenRecommendations(groups: any[]): any[] {
  const out: any[] = []
  const seen = new Set<string>()
  for (const g of groups) {
    const relationships = g?.relationships
    const source =
      relationships?.contents?.data ?? relationships?.recommendations?.data ?? []
    for (const item of source) {
      const key = item.id + (item.type ?? '')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}
