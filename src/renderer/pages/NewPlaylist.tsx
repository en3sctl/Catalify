import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import {
  ChevronLeft,
  GripVertical,
  Music,
  Plus,
  Search as SearchIcon,
  Sparkles,
  X,
} from 'lucide-react'
import {
  createLibraryPlaylist,
  getArtist,
  getHeavyRotation,
  search as catalogSearch,
} from '../utils/musickit-api'
import { toast } from '../store/toast'
import { artworkUrl, clsx, formatDuration } from '../utils/format'

/**
 * Full-page playlist editor — no modal dialog. Flow:
 *   1. Name + description at the top (big typography, feels like an
 *      Apple Music / Spotify playlist header).
 *   2. "Add songs" search with inline results the user clicks to add.
 *   3. Track list (drag-reorder + remove) same Reorder.Group pattern
 *      used by the queue drawer.
 *   4. Suggestions rail below — pulled from the first-added artist's
 *      top songs, falling back to heavy rotation. Click "+" to add a
 *      suggestion; the list refreshes so there's always something new.
 *   5. Save commits everything in one MusicKit call, toasts, and
 *      navigates to the library.
 */
export function NewPlaylist() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tracks, setTracks] = useState<TrackModel[]>([])
  const [busy, setBusy] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<TrackModel[]>([])
  const [searching, setSearching] = useState(false)

  const [suggestions, setSuggestions] = useState<TrackModel[]>([])

  const searchDebounceRef = useRef<number | null>(null)

  // Debounced search. We search SONGS only — keep the surface narrow so
  // the results list stays fast and predictable.
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
        setSearchResults(songs.map(toTrackModel))
      } catch (e) {
        console.warn('[new-playlist] search failed', e)
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current)
    }
  }, [searchTerm])

  // Suggestions: seed on the last track's artist if we have any, else
  // fall back to the user's heavy rotation.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const seed = tracks[tracks.length - 1]
      try {
        if (seed?.artistId) {
          const artist = await getArtist(seed.artistId)
          const views = artist?.views?.['top-songs']?.data ?? []
          const addedIds = new Set(tracks.map((t) => t.id))
          const picks = views
            .map(toTrackModel)
            .filter((t: TrackModel) => !addedIds.has(t.id))
            .slice(0, 5)
          if (!cancelled && picks.length > 0) {
            setSuggestions(picks)
            return
          }
        }
        const rotation = await getHeavyRotation(20)
        const addedIds = new Set(tracks.map((t) => t.id))
        const picks: TrackModel[] = []
        for (const item of rotation) {
          // Heavy-rotation items are albums/playlists — drill for their
          // first song so we can actually add a track, not an album.
          const firstSong = item?.relationships?.tracks?.data?.[0]
          if (firstSong) {
            const tm = toTrackModel(firstSong)
            if (tm.id && !addedIds.has(tm.id)) picks.push(tm)
          }
          if (picks.length >= 5) break
        }
        if (!cancelled) setSuggestions(picks)
      } catch (e) {
        if (!cancelled) setSuggestions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tracks.length, tracks[tracks.length - 1]?.artistId])

  const addTrack = (t: TrackModel) => {
    if (!t.id) return
    if (tracks.some((x) => x.id === t.id)) return
    setTracks((cur) => [...cur, t])
  }

  const removeTrack = (id: string) => {
    setTracks((cur) => cur.filter((t) => t.id !== id))
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name required', 'Give your playlist a name first.')
      return
    }
    setBusy(true)
    try {
      const ids = tracks.map((t) => t.id).filter(Boolean)
      await createLibraryPlaylist(name.trim(), description.trim() || undefined, ids)
      // Apple's library index typically takes ~1-2 s to reflect a new
      // playlist. If we navigate immediately the Library grid's fetch
      // runs before the write lands and shows "Nothing here yet". Wait
      // briefly, then navigate — by the time Library mounts and fetches
      // the list includes the new playlist.
      toast.success('Playlist created', `"${name.trim()}" — updating your library…`)
      await new Promise((r) => setTimeout(r, 1500))
      navigate('/library')
    } catch (err: any) {
      toast.error('Failed to create playlist', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const totalDuration = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0),
    [tracks],
  )

  return (
    <div className="space-y-8 pb-16">
      {/* ── Header: playlist title + metadata ── */}
      <div className="flex items-center gap-2 -ml-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[13px] text-obsidian-300 hover:text-cream hover:bg-white/[0.04] transition"
        >
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      <div className="flex items-end gap-6 flex-wrap">
        <PlaylistCoverMosaic tracks={tracks} />
        <div className="flex-1 min-w-[280px] space-y-3">
          <div className="text-[11px] uppercase tracking-[0.2em] accent-text font-medium">
            Playlist
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            className="w-full bg-transparent font-display text-[42px] md:text-[56px] font-bold tracking-tight leading-[0.95] text-cream placeholder:text-obsidian-500 outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description — optional"
            rows={2}
            className="w-full bg-transparent text-[14px] text-obsidian-200 placeholder:text-obsidian-500 outline-none resize-none"
          />
          <div className="flex items-center gap-4 text-[12px] text-obsidian-300">
            <span>
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </span>
            {totalDuration > 0 && <span>·</span>}
            {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
          </div>
          <div className="pt-2 flex gap-2">
            <button
              onClick={save}
              disabled={busy || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-cream text-obsidian-950 font-semibold text-[13px] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {busy ? 'Saving…' : 'Save playlist'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 rounded-xl text-[13px] text-obsidian-200 hover:text-white hover:bg-white/[0.04] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* ── Track list (current playlist) ── */}
      {tracks.length > 0 && (
        <section>
          <SectionTitle title="In this playlist" subtitle="Drag to reorder" />
          <Reorder.Group
            axis="y"
            values={tracks}
            onReorder={setTracks}
            className="flex flex-col divide-y divide-white/[0.03]"
          >
            {tracks.map((t, i) => (
              <PlaylistTrackRow
                key={t.id}
                index={i + 1}
                track={t}
                onRemove={() => removeTrack(t.id)}
              />
            ))}
          </Reorder.Group>
        </section>
      )}

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
                {searchResults.map((t) => {
                  const added = tracks.some((x) => x.id === t.id)
                  return (
                    <SearchResultRow
                      key={t.id}
                      track={t}
                      added={added}
                      onAdd={() => addTrack(t)}
                    />
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Suggestions ── */}
      {suggestions.length > 0 && (
        <section>
          <SectionTitle
            title="Suggestions"
            subtitle={
              tracks.length > 0
                ? 'More from the same vibe'
                : 'Based on what you listen to lately'
            }
            icon={<Sparkles size={14} className="accent-text" />}
          />
          <div className="flex flex-col divide-y divide-white/[0.03]">
            {suggestions.map((t) => (
              <SearchResultRow
                key={t.id}
                track={t}
                added={tracks.some((x) => x.id === t.id)}
                onAdd={() => addTrack(t)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* ── Components ─────────────────────────────────────────────── */

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

/**
 * 2×2 mosaic of the first four added tracks' cover art, so the
 * playlist cover reflects its contents Apple Music-style. When empty,
 * an accent gradient placeholder stands in.
 */
function PlaylistCoverMosaic({ tracks }: { tracks: TrackModel[] }) {
  const arts = tracks.slice(0, 4).map((t) => t.artworkUrl).filter(Boolean) as string[]
  if (arts.length === 0) {
    return (
      <div className="w-[220px] h-[220px] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]"
           style={{
             background:
               'linear-gradient(135deg, rgb(var(--accent) / 0.75) 0%, rgb(var(--accent-soft) / 0.65) 100%)',
           }}>
        <Music size={56} className="text-obsidian-950/70" />
      </div>
    )
  }
  if (arts.length < 4) {
    const img = arts[0]
    return (
      <div className="w-[220px] h-[220px] rounded-2xl overflow-hidden flex-shrink-0 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]">
        <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
    )
  }
  return (
    <div className="w-[220px] h-[220px] rounded-2xl overflow-hidden grid grid-cols-2 grid-rows-2 flex-shrink-0 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]">
      {arts.map((src, i) => (
        <img key={i} src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      ))}
    </div>
  )
}

function PlaylistTrackRow({
  track,
  index,
  onRemove,
}: {
  track: TrackModel
  index: number
  onRemove: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, zIndex: 50, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.6)' }}
      className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] select-none"
    >
      <div
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing text-obsidian-400 hover:text-white/80 touch-none flex-shrink-0"
        title="Drag"
      >
        <GripVertical size={14} />
      </div>
      <div className="w-6 text-center text-[12px] font-mono text-obsidian-400 flex-shrink-0">
        {index}
      </div>
      <img
        src={track.artworkUrl ?? ''}
        alt=""
        draggable={false}
        className="w-10 h-10 rounded bg-obsidian-800 object-cover flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-cream">{track.title}</div>
        <div className="truncate text-[12px] text-obsidian-300">{track.artistName}</div>
      </div>
      <div className="text-[12px] text-obsidian-400 font-mono tabular-nums flex-shrink-0">
        {formatDuration(track.durationMs)}
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-obsidian-400 hover:text-red-400 transition flex-shrink-0"
        title="Remove"
      >
        <X size={14} />
      </button>
    </Reorder.Item>
  )
}

function SearchResultRow({
  track,
  added,
  onAdd,
}: {
  track: TrackModel
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

/* ── Types / helpers ─────────────────────────────────────────── */

interface TrackModel {
  id: string
  title: string
  artistName: string
  albumName: string
  artworkUrl?: string
  durationMs: number
  artistId?: string
}

function toTrackModel(raw: any): TrackModel {
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
