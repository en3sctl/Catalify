import { useEffect, useRef, useState } from 'react'
import { Loader2, Music2, Pencil, Search, User, X } from 'lucide-react'
import { search } from '../utils/musickit-api'
import { artworkUrl, clsx } from '../utils/format'
import { FavoriteItem } from '../utils/social-api'

/**
 * Favorites showcase editor (v0.1.22). Two slots — favorite artist and
 * favorite song — each opening a small inline catalog search. The picked
 * item is stored on the social profile as tiny JSON ({id, name, artUrl})
 * so friend profiles can render it without an Apple round-trip.
 */
export function FavoritesEditor({
  favoriteArtist,
  favoriteSong,
  onChange,
}: {
  favoriteArtist: FavoriteItem | null | undefined
  favoriteSong: FavoriteItem | null | undefined
  onChange: (patch: {
    favoriteArtist?: FavoriteItem | null
    favoriteSong?: FavoriteItem | null
  }) => Promise<void>
}) {
  return (
    <div className="mt-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-obsidian-400 font-medium mb-2">
        Favorites — shown on your profile
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <FavoriteSlot
          kind="artist"
          value={favoriteArtist ?? null}
          onPick={(v) => onChange({ favoriteArtist: v })}
        />
        <FavoriteSlot
          kind="song"
          value={favoriteSong ?? null}
          onPick={(v) => onChange({ favoriteSong: v })}
        />
      </div>
    </div>
  )
}

function FavoriteSlot({
  kind,
  value,
  onPick,
}: {
  kind: 'artist' | 'song'
  value: FavoriteItem | null
  onPick: (v: FavoriteItem | null) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const commit = async (v: FavoriteItem | null) => {
    setBusy(true)
    try {
      await onPick(v)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 min-w-0 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-[11.5px] text-obsidian-300">
          {kind === 'artist' ? <User size={12} /> : <Music2 size={12} />}
          Favorite {kind}
        </span>
        <div className="flex items-center gap-1">
          {value && !open && (
            <button
              onClick={() => commit(null)}
              disabled={busy}
              className="p-1 rounded-md text-obsidian-400 hover:text-rose-300 hover:bg-white/[0.06] transition"
              title="Clear"
            >
              <X size={13} />
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1 rounded-md text-obsidian-400 hover:text-cream hover:bg-white/[0.06] transition"
            title={value ? 'Change' : 'Pick one'}
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {value && !open ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={value.artUrl ?? undefined}
            alt=""
            className={clsx(
              'w-10 h-10 object-cover bg-white/[0.06] flex-shrink-0',
              kind === 'artist' ? 'rounded-full' : 'rounded-lg',
            )}
          />
          <div className="min-w-0">
            <div className="text-[13px] text-cream font-medium truncate">{value.name}</div>
            {value.artistName && (
              <div className="text-[11.5px] text-obsidian-400 truncate">{value.artistName}</div>
            )}
          </div>
        </div>
      ) : open ? (
        <FavoriteSearch kind={kind} busy={busy} onPick={commit} />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left text-[12.5px] text-obsidian-400 hover:text-cream rounded-lg px-2 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition"
        >
          Pick your favorite {kind}…
        </button>
      )}
    </div>
  )
}

function FavoriteSearch({
  kind,
  busy,
  onPick,
}: {
  kind: 'artist' | 'song'
  busy: boolean
  onPick: (v: FavoriteItem) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FavoriteItem[]>([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef<number | null>(null)

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current)
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    debounce.current = window.setTimeout(async () => {
      try {
        const res = await search(term, [kind === 'artist' ? 'artists' : 'songs'], 6)
        const data =
          kind === 'artist' ? res?.artists?.data ?? [] : res?.songs?.data ?? []
        setResults(
          data.map((d: any) => ({
            id: String(d.id),
            name: d.attributes?.name ?? '',
            artistName: kind === 'song' ? d.attributes?.artistName : undefined,
            artUrl: artworkUrl(d.attributes?.artwork?.url, 120) ?? null,
          })),
        )
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current)
    }
  }, [q, kind])

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08]">
        <Search size={13} className="text-obsidian-400 flex-shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === 'artist' ? 'Search artists…' : 'Search songs…'}
          className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-cream placeholder:text-obsidian-500"
        />
        {(searching || busy) && <Loader2 size={13} className="animate-spin text-obsidian-400" />}
      </div>
      {results.length > 0 && (
        <div className="mt-1.5 flex flex-col max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              disabled={busy}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition text-left min-w-0"
            >
              <img
                src={r.artUrl ?? undefined}
                alt=""
                className={clsx(
                  'w-8 h-8 object-cover bg-white/[0.06] flex-shrink-0',
                  kind === 'artist' ? 'rounded-full' : 'rounded-md',
                )}
              />
              <div className="min-w-0">
                <div className="text-[12.5px] text-cream truncate">{r.name}</div>
                {r.artistName && (
                  <div className="text-[11px] text-obsidian-400 truncate">{r.artistName}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
