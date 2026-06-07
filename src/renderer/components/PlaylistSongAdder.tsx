import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Music, Plus, Search as SearchIcon, Sparkles, X } from 'lucide-react'
import {
  getCatalogSongsByIds,
  getCharts,
  getHeavyRotation,
  getRadioContinuation,
  search as catalogSearch,
} from '../utils/musickit-api'
import { artworkUrl, clsx, formatDuration } from '../utils/format'

export interface AdderTrack {
  id: string
  title: string
  artistName: string
  albumName: string
  artworkUrl?: string
  durationMs: number
  artistId?: string
}

export function toAdderTrack(raw: any): AdderTrack {
  const a = raw?.attributes ?? {}
  const catalogId = a.playParams?.catalogId || raw?.id || ''
  const artistRel = raw?.relationships?.artists?.data?.[0]
  return {
    id: String(catalogId),
    title: a.name ?? 'Unknown',
    artistName: a.artistName ?? '',
    albumName: a.albumName ?? '',
    artworkUrl: artworkUrl(a.artwork?.url, 200),
    durationMs: a.durationInMillis ?? 0,
    artistId: artistRel?.id || a.artistId,
  }
}

type Entry = { track: AdderTrack; raw: any }

interface Props {
  /** Catalog ids already in the playlist/draft — excluded + shown as added. */
  existingIds: string[]
  /** Artist ids to seed the recommendation feed (most relevant last). */
  seedArtistIds: string[]
  /** Called when the user adds a search result or a suggestion. `raw` is the
   *  original Apple object (so callers can append it to a track list). */
  onAdd: (track: AdderTrack, raw: any) => void
}

/**
 * The "Add songs" surface shared by the create-playlist page and the
 * playlist detail page: a debounced catalog search with one-click add, plus
 * a Spotify-style "Recommended" feed where "+" adds and "×" skips — either
 * way the card is replaced by a fresh, relevant suggestion.
 */
export function PlaylistSongAdder({ existingIds, seedArtistIds, onAdd }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Entry[]>([])
  const [searching, setSearching] = useState(false)
  const searchDebounceRef = useRef<number | null>(null)

  const [recPool, setRecPool] = useState<Entry[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const refillingRef = useRef(false)

  // Latest props read inside async refills without re-creating the callback.
  const existingRef = useRef(existingIds)
  existingRef.current = existingIds
  const seedRef = useRef(seedArtistIds)
  seedRef.current = seedArtistIds

  const existingSet = new Set(existingIds)
  const seedKey = seedArtistIds.join(',')

  // Debounced songs-only catalog search.
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    if (!searchTerm.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await catalogSearch(searchTerm.trim(), ['songs'], 15)
        const songs = (res?.songs?.data ?? []) as any[]
        setSearchResults(songs.map((raw) => ({ track: toAdderTrack(raw), raw })))
      } catch (e) {
        console.warn('[song-adder] search failed', e)
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    }
  }, [searchTerm])

  const refillSuggestions = useCallback(async () => {
    if (refillingRef.current) return
    refillingRef.current = true
    try {
      const exclude = new Set<string>(seenRef.current)
      existingRef.current.forEach((id) => exclude.add(id))
      const fresh: Entry[] = []
      const pushUnique = (raw: any) => {
        const t = toAdderTrack(raw)
        if (t.id && !exclude.has(t.id)) {
          exclude.add(t.id)
          fresh.push({ track: t, raw })
        }
      }

      const seedArtists = [...new Set(seedRef.current.slice(-3))].filter(Boolean) as string[]

      // 1) When the playlist already has songs, keep suggestions in the SAME
      //    vibe: pull the seed artists' tracks + their similar artists
      //    (reuses the radio-continuation seed), then hydrate to full song
      //    objects. This is what makes recs feel related rather than random.
      if (seedArtists.length > 0) {
        const ids: string[] = []
        for (const aid of seedArtists) {
          try {
            const { ids: rids } = await getRadioContinuation('', aid, exclude, 18)
            ids.push(...rids)
          } catch {}
          if (ids.length >= 24) break
        }
        const uniqIds = [...new Set(ids)].filter((id) => !exclude.has(id)).slice(0, 25)
        if (uniqIds.length > 0) {
          try {
            const songs = await getCatalogSongsByIds(uniqIds)
            for (const s of songs) pushUnique(s)
          } catch {}
        }
      }

      // 2) Fallback ONLY for an empty playlist (no seed yet) or if nothing
      //    relevant came back — storefront charts (language-appropriate),
      //    then heavy rotation. We deliberately DON'T mix generic charts in
      //    when we have seed artists, so the feed stays on-genre.
      if (fresh.length < 6 && seedArtists.length === 0) {
        try {
          const { songs } = await getCharts(['songs'], 30)
          for (const s of songs) pushUnique(s)
        } catch {}
        try {
          const rotation = await getHeavyRotation(20)
          for (const item of rotation) {
            const firstSong = item?.relationships?.tracks?.data?.[0]
            if (firstSong) pushUnique(firstSong)
          }
        } catch {}
      }

      if (fresh.length > 0) {
        setRecPool((cur) => {
          const have = new Set(cur.map((x) => x.track.id))
          return [...cur, ...fresh.filter((x) => !have.has(x.track.id))]
        })
      }
    } finally {
      refillingRef.current = false
    }
  }, [])

  // Keep the pool stocked; re-evaluates when it drains or the seed changes.
  useEffect(() => {
    if (recPool.length < 6) refillSuggestions()
  }, [recPool.length, seedKey, refillSuggestions])

  // Drop already-added items from the pool if they got added via search.
  useEffect(() => {
    setRecPool((cur) => cur.filter((x) => !existingSet.has(x.track.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingIds.length])

  const handleAdd = (entry: Entry) => {
    seenRef.current.add(entry.track.id)
    onAdd(entry.track, entry.raw)
    setRecPool((cur) => cur.filter((x) => x.track.id !== entry.track.id))
  }
  const handleSkip = (entry: Entry) => {
    seenRef.current.add(entry.track.id)
    setRecPool((cur) => cur.filter((x) => x.track.id !== entry.track.id))
  }

  const visibleSuggestions = recPool.slice(0, 6)

  return (
    <div className="space-y-8">
      {/* ── Search: add songs ── */}
      <section>
        <SectionTitle title="Add songs" subtitle="Search the catalog" />
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/[0.06] focus-within:border-white/[0.14] transition">
          <SearchIcon size={17} className="text-obsidian-300 flex-shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find songs to add…"
            className="flex-1 bg-transparent outline-none text-[14px] text-cream placeholder:text-obsidian-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-obsidian-400 hover:text-white transition"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {searchTerm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-2xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
                {searching && (
                  <div className="px-4 py-3 text-[13px] text-obsidian-400 italic">Searching…</div>
                )}
                {!searching && searchResults.length === 0 && (
                  <div className="px-4 py-3 text-[13px] text-obsidian-400 italic">
                    No results for "{searchTerm}".
                  </div>
                )}
                {searchResults.map((entry) => (
                  <SearchResultRow
                    key={entry.track.id}
                    track={entry.track}
                    added={existingSet.has(entry.track.id)}
                    onAdd={() => handleAdd(entry)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Recommended (Spotify-style add / skip feed) ── */}
      {visibleSuggestions.length > 0 && (
        <section>
          <SectionTitle
            title="Recommended"
            subtitle={
              seedArtistIds.length > 0
                ? 'More like what you added — add or skip'
                : 'Based on what you listen to — add or skip'
            }
            icon={<Sparkles size={14} className="accent-text" />}
          />
          <div className="rounded-2xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
            <AnimatePresence initial={false}>
              {visibleSuggestions.map((entry) => (
                <motion.div
                  key={entry.track.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <SuggestionRow
                    track={entry.track}
                    onAdd={() => handleAdd(entry)}
                    onSkip={() => handleSkip(entry)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */

function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-[20px] font-bold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-[12px] text-obsidian-300 mt-1">{subtitle}</p>}
    </div>
  )
}

function SearchResultRow({
  track,
  added,
  onAdd,
}: {
  track: AdderTrack
  added: boolean
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition">
      <img
        src={track.artworkUrl ?? ''}
        alt=""
        draggable={false}
        className="w-10 h-10 rounded bg-obsidian-800 object-cover flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-cream">{track.title}</div>
        <div className="truncate text-[12px] text-obsidian-300">
          {track.artistName}
          {track.albumName && <span className="text-obsidian-400"> · {track.albumName}</span>}
        </div>
      </div>
      <div className="text-[12px] text-obsidian-400 font-mono tabular-nums flex-shrink-0">
        {formatDuration(track.durationMs)}
      </div>
      <button
        onClick={onAdd}
        disabled={added}
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition',
          added
            ? 'bg-white/[0.05] text-obsidian-400 cursor-default'
            : 'bg-white/[0.06] text-white hover:bg-cream hover:text-obsidian-950',
        )}
        title={added ? 'Already added' : 'Add'}
      >
        {added ? <Music size={13} /> : <Plus size={14} />}
      </button>
    </div>
  )
}

function SuggestionRow({
  track,
  onAdd,
  onSkip,
}: {
  track: AdderTrack
  onAdd: () => void
  onSkip: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition">
      <img
        src={track.artworkUrl ?? ''}
        alt=""
        draggable={false}
        className="w-10 h-10 rounded bg-obsidian-800 object-cover flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-cream">{track.title}</div>
        <div className="truncate text-[12px] text-obsidian-300">
          {track.artistName}
          {track.albumName && <span className="text-obsidian-400"> · {track.albumName}</span>}
        </div>
      </div>
      <div className="text-[12px] text-obsidian-400 font-mono tabular-nums flex-shrink-0">
        {formatDuration(track.durationMs)}
      </div>
      <button
        onClick={onSkip}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-obsidian-400 hover:text-white hover:bg-white/[0.06] transition"
        title="Not interested — skip"
      >
        <X size={15} />
      </button>
      <button
        onClick={onAdd}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/[0.06] text-white hover:bg-cream hover:text-obsidian-950 transition"
        title="Add to playlist"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
