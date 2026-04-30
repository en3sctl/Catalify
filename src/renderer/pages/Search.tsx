import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, X, Quote, Music } from 'lucide-react'
import { search, playSongs } from '../utils/musickit-api'
import { Artwork } from '../components/Artwork'
import { TrackRow } from '../components/TrackRow'
import { artworkUrl, clsx } from '../utils/format'

type Mode = 'all' | 'lyrics'

const RECENT_KEY = 'recentSearches'
const MAX_RECENT = 10

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const [term, setTerm] = useState(initialQ)
  const [mode, setMode] = useState<Mode>('all')
  const [results, setResults] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    window.bombo.store.get<string[]>(RECENT_KEY).then((v) => setRecent(Array.isArray(v) ? v : []))
  }, [])

  // Mirror the term into `?q=` so deep-linked searches survive refresh
  // and navigation from Home keeps the input populated.
  useEffect(() => {
    if (term.trim() === (searchParams.get('q') ?? '')) return
    if (term.trim()) setSearchParams({ q: term.trim() }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [term])

  useEffect(() => {
    if (!term.trim()) { setResults(null); return }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const types = mode === 'lyrics' ? ['songs'] : ['songs', 'albums', 'artists', 'playlists']
        const limit = mode === 'lyrics' ? 25 : 20
        const res = await search(term.trim(), types, limit)
        setResults(res)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [term, mode])

  const commitRecent = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    const next = [trimmed, ...recent.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT)
    setRecent(next)
    window.bombo.store.set(RECENT_KEY, next)
  }

  const clearRecent = () => { setRecent([]); window.bombo.store.set(RECENT_KEY, []) }

  const songs = results?.songs?.data ?? []
  const albums = results?.albums?.data ?? []
  const artists = results?.artists?.data ?? []
  const playlists = results?.playlists?.data ?? []

  return (
    <div className="space-y-8 pb-10">
      <div className="sticky top-0 z-10 -mx-8 -mt-8 px-8 pt-8 pb-4 bg-gradient-to-b from-obsidian-950 via-obsidian-950/95 to-transparent">
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.06] focus-within:border-white/[0.14] transition">
          {mode === 'lyrics' ? <Quote size={18} className="accent-text" /> : <SearchIcon size={18} className="text-obsidian-300" />}
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => commitRecent(term)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRecent(term) }}
            placeholder={
              mode === 'lyrics'
                ? 'Search for a lyric — "time to say goodbye"…'
                : 'Search songs, albums, artists, playlists…'
            }
            className="flex-1 bg-transparent outline-none text-white placeholder:text-obsidian-400 selectable"
          />
          {term && (
            <button
              onClick={() => { setTerm(''); inputRef.current?.focus() }}
              className="text-obsidian-400 hover:text-white p-1"
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
          {loading && (
            <span className="w-4 h-4 rounded-full border-2 border-obsidian-400 border-t-transparent animate-spin"></span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3">
          <ModeChip active={mode === 'all'} onClick={() => setMode('all')}>
            <Music size={13} /> Everything
          </ModeChip>
          <ModeChip active={mode === 'lyrics'} onClick={() => setMode('lyrics')}>
            <Quote size={13} /> By lyrics
          </ModeChip>
        </div>
      </div>

      {!term && (
        <div className="space-y-6">
          {recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-display">Recent searches</h2>
                <button
                  onClick={clearRecent}
                  className="text-[11px] text-obsidian-400 hover:text-white"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((q) => (
                  <button
                    key={q}
                    onClick={() => setTerm(q)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-[12.5px] text-white hover:bg-white/[0.06] transition"
                  >
                    <SearchIcon size={12} className="text-obsidian-400" />
                    {q}
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const next = recent.filter((r) => r !== q)
                        setRecent(next)
                        window.bombo.store.set(RECENT_KEY, next)
                      }}
                      className="ml-1 text-obsidian-500 hover:text-obsidian-200"
                    >
                      <X size={12} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <SearchHints />
        </div>
      )}

      {mode === 'lyrics' && term && songs.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-[18px] font-display">Songs matching <em className="italic accent-text">"{term}"</em></h2>
            <p className="text-[11px] text-obsidian-400 mt-0.5">
              Apple Music's search matches titles + artist names best; true lyric matching depends on song metadata.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {songs.map((s: any, i: number) => (
              <TrackRow
                key={s.id}
                index={i}
                track={s}
                onPlay={() => { commitRecent(term); playSongs([s.id], 0).catch(console.error) }}
              />
            ))}
          </div>
        </section>
      )}

      {mode === 'all' && songs.length > 0 && (
        <section>
          <h2 className="text-[18px] font-display mb-3">Songs</h2>
          <div className="flex flex-col gap-1">
            {songs.slice(0, 8).map((s: any, i: number) => (
              <TrackRow
                key={s.id}
                index={i}
                track={s}
                onPlay={() => { commitRecent(term); playSongs([s.id], 0).catch(console.error) }}
              />
            ))}
          </div>
        </section>
      )}

      {mode === 'all' && albums.length > 0 && <GridSection title="Albums" items={albums} kind="album" />}
      {mode === 'all' && artists.length > 0 && <GridSection title="Artists" items={artists} kind="artist" rounded />}
      {mode === 'all' && playlists.length > 0 && <GridSection title="Playlists" items={playlists} kind="playlist" />}

      {term && !loading && results && (songs.length + albums.length + artists.length + playlists.length === 0) && (
        <div className="text-obsidian-400 italic text-center py-8">
          No results for <em>"{term}"</em>.
        </div>
      )}
    </div>
  )
}

function ModeChip({
  children, active, onClick,
}: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition',
        active
          ? 'accent-bg text-obsidian-950 font-semibold'
          : 'bg-white/[0.04] text-obsidian-200 hover:bg-white/[0.08]',
      )}
    >
      {children}
    </button>
  )
}

function SearchHints() {
  const HINTS = [
    'Sezen Aksu',
    'Pink Floyd',
    'lo-fi beats',
    'Türkçe rock',
    'sad piano',
    'Kendrick Lamar',
    'bossa nova',
    'workout',
  ]
  return (
    <section>
      <h2 className="text-[18px] font-display mb-3">Try searching</h2>
      <div className="flex flex-wrap gap-2">
        {HINTS.map((h) => (
          <button
            key={h}
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('.glass input')
              if (input) { input.value = h; input.focus() }
              // Also push into state via a synthetic event — simpler: use custom event
              const ev = new CustomEvent('bombo:search', { detail: h })
              window.dispatchEvent(ev)
            }}
            className="px-3 py-1.5 rounded-full glass text-[12.5px] hover:bg-white/[0.06] transition"
          >
            {h}
          </button>
        ))}
      </div>
    </section>
  )
}

function GridSection({
  title, items, kind, rounded,
}: { title: string; items: any[]; kind: 'album' | 'artist' | 'playlist'; rounded?: boolean }) {
  return (
    <section>
      <h2 className="text-[18px] font-display mb-3">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.slice(0, 10).map((item) => {
          const attrs = item.attributes ?? {}
          const art = artworkUrl(attrs.artwork?.url, 400)
          const to =
            kind === 'album'
              ? `/album/${item.id}`
              : kind === 'playlist'
                ? `/playlist/${item.id}`
                : kind === 'artist'
                  ? `/artist/${item.id}`
                  : `#`
          return (
            <Link
              key={item.id}
              to={to}
              className="group block rounded-xl p-3 hover:bg-white/[0.04] transition"
            >
              <Artwork src={art} size="hero" rounded={rounded ? 'full' : 'lg'} alt={attrs.name} />
              <div className="mt-3 truncate text-[13.5px] font-semibold text-white">{attrs.name}</div>
              <div className="truncate text-[12px] text-obsidian-300">
                {attrs.artistName ?? attrs.curatorName ?? ''}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
