import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Reorder, useDragControls } from 'framer-motion'
import { Camera, ChevronLeft, GripVertical, Music, X } from 'lucide-react'
import { createLibraryPlaylist } from '../utils/musickit-api'
import { toast } from '../store/toast'
import { clsx, formatDuration } from '../utils/format'
import { resizeImageToDataUrl } from '../utils/image'
import { setPlaylistCover } from '../utils/playlist-covers'
import { PlaylistSongAdder, AdderTrack } from '../components/PlaylistSongAdder'

/**
 * Full-page playlist editor — no modal dialog. Flow:
 *   1. Name + description at the top (big typography). The cover is a custom
 *      photo if the user uploads one, else a 2×2 mosaic of track art.
 *   2. Track list (drag-reorder + remove).
 *   3. <PlaylistSongAdder>: search-and-add + a Spotify-style "Recommended"
 *      feed (one-click add, one-click skip) — the same surface the playlist
 *      detail page uses for adding songs later.
 *   4. Save commits everything in one MusicKit call, stores the local cover
 *      (Apple's API can't set custom artwork) and an optimistic snapshot so
 *      the new playlist shows in the library immediately, then navigates.
 */
export function NewPlaylist() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tracks, setTracks] = useState<AdderTrack[]>([])
  const [busy, setBusy] = useState(false)

  // Custom cover photo (local-only — Apple's API can't set playlist art).
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const addTrack = (t: AdderTrack) => {
    if (!t.id) return
    if (tracks.some((x) => x.id === t.id)) return
    setTracks((cur) => [...cur, t])
  }

  const removeTrack = (id: string) => {
    setTracks((cur) => cur.filter((t) => t.id !== id))
  }

  const onPickCover = () => coverInputRef.current?.click()
  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      const dataUrl = await resizeImageToDataUrl(file, 600, true)
      setCoverDataUrl(dataUrl)
    } catch (err) {
      console.warn('[new-playlist] cover resize failed', err)
      toast.error('Couldn\'t load that image', 'Try a different photo.')
    }
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name required', 'Give your playlist a name first.')
      return
    }
    setBusy(true)
    try {
      const ids = tracks.map((t) => t.id).filter(Boolean)
      const playlist = await createLibraryPlaylist(
        name.trim(),
        description.trim() || undefined,
        ids,
      )
      const newId = playlist?.id ? String(playlist.id) : ''
      // Persist the custom cover locally, keyed by the new library playlist
      // id (Apple's API can't store custom playlist artwork).
      if (coverDataUrl && newId) {
        try {
          await setPlaylistCover(newId, coverDataUrl)
        } catch (err) {
          console.warn('[new-playlist] cover save failed', err)
        }
      }
      // Apple's /v1/me/library/playlists list can lag minutes behind a
      // successful POST while their index reindexes — exactly like albums.
      // Stash an optimistic snapshot so the Library/Home merge it on top
      // immediately and drop it once Apple finally returns the same id.
      if (newId) {
        try {
          const existing =
            (await window.bombo.store.get<any[]>('optimisticLibraryPlaylists')) || []
          const dedupe = existing.filter((p) => String(p?.id) !== newId)
          const snapshot = {
            id: newId,
            type: 'library-playlists',
            attributes: {
              name: name.trim(),
              dateAdded: new Date().toISOString(),
              canEdit: true,
              playParams: { id: newId, kind: 'playlist', isLibrary: true },
            },
          }
          await window.bombo.store.set('optimisticLibraryPlaylists', [snapshot, ...dedupe])
        } catch (err) {
          console.warn('[new-playlist] optimistic stash failed', err)
        }
      }
      toast.success('Playlist created', `"${name.trim()}" — updating your library…`)
      await new Promise((r) => setTimeout(r, 800))
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

  const existingIds = useMemo(() => tracks.map((t) => t.id), [tracks])
  const seedArtistIds = useMemo(
    () => tracks.map((t) => t.artistId).filter(Boolean) as string[],
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
        <PlaylistCoverMosaic
          tracks={tracks}
          coverDataUrl={coverDataUrl}
          onPickCover={onPickCover}
          onClearCover={() => setCoverDataUrl(null)}
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={onCoverChange}
          className="hidden"
        />
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
          <div className="mb-3">
            <h2 className="font-display text-[20px] font-bold tracking-tight">In this playlist</h2>
            <p className="text-[12px] text-obsidian-300 mt-1">Drag to reorder</p>
          </div>
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

      {/* ── Add songs: search + recommended (shared component) ── */}
      <PlaylistSongAdder
        existingIds={existingIds}
        seedArtistIds={seedArtistIds}
        onAdd={(t) => addTrack(t)}
      />
    </div>
  )
}

/* ── Components ─────────────────────────────────────────────── */

/**
 * Playlist cover. A user-uploaded photo wins; otherwise a 2×2 mosaic of the
 * first four added tracks' art (Apple Music-style), or an accent gradient
 * placeholder when empty. Hovering reveals an "upload cover" affordance.
 */
function PlaylistCoverMosaic({
  tracks,
  coverDataUrl,
  onPickCover,
  onClearCover,
}: {
  tracks: AdderTrack[]
  coverDataUrl: string | null
  onPickCover: () => void
  onClearCover: () => void
}) {
  const arts = tracks.slice(0, 4).map((t) => t.artworkUrl).filter(Boolean) as string[]

  let inner: React.ReactNode
  if (coverDataUrl) {
    inner = <img src={coverDataUrl} alt="" className="w-full h-full object-cover" draggable={false} />
  } else if (arts.length === 0) {
    inner = (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, rgb(var(--accent) / 0.75) 0%, rgb(var(--accent-soft) / 0.65) 100%)',
        }}
      >
        <Music size={56} className="text-obsidian-950/70" />
      </div>
    )
  } else if (arts.length < 4) {
    inner = <img src={arts[0]} alt="" className="w-full h-full object-cover" draggable={false} />
  } else {
    inner = (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2">
        {arts.map((src, i) => (
          <img key={i} src={src} alt="" className="w-full h-full object-cover" draggable={false} />
        ))}
      </div>
    )
  }

  return (
    <div className="group relative w-[220px] h-[220px] rounded-2xl overflow-hidden flex-shrink-0 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]">
      {inner}
      <button
        onClick={onPickCover}
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white opacity-0 group-hover:opacity-100 transition"
        title={coverDataUrl ? 'Replace cover' : 'Add a cover photo'}
      >
        <Camera size={26} />
        <span className="text-[12px] font-medium">
          {coverDataUrl ? 'Replace cover' : 'Add cover photo'}
        </span>
      </button>
      {coverDataUrl && (
        <button
          onClick={onClearCover}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/55 text-white/85 hover:text-white hover:bg-black/75 opacity-0 group-hover:opacity-100 transition"
          title="Remove cover"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

function PlaylistTrackRow({
  track,
  index,
  onRemove,
}: {
  track: AdderTrack
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
