import { Play, Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../store/player'
import { Artwork } from './Artwork'
import { artworkUrl, clsx, formatDuration } from '../utils/format'
import { useContextMenu } from './ContextMenuProvider'
import { trackContextItems } from '../utils/track-actions'
import { resolveTrackTargets } from '../utils/musickit-api'

export interface TrackRowProps {
  index: number
  track: any
  onPlay: () => void
  showArt?: boolean
  showAlbum?: boolean
}

export function TrackRow({ index, track, onPlay, showArt = true, showAlbum = true }: TrackRowProps) {
  const current = usePlayer((s) => s.nowPlaying)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const likedIds = usePlayer((s) => s.likedIds)
  const toggleLike = usePlayer((s) => s.toggleLike)
  const contextMenu = useContextMenu()
  const navigate = useNavigate()
  const attrs = track.attributes ?? {}
  const title = attrs.name
  const artist = attrs.artistName
  const album = attrs.albumName
  const duration = attrs.durationInMillis ?? 0
  const art = artworkUrl(attrs.artwork?.url, 120)
  // Library songs carry their catalog id in playParams.catalogId
  const catalogId = attrs.playParams?.catalogId || track.id
  const liked = !!likedIds[catalogId]
  const isActive = current?.id === catalogId || current?.id === track.id
  // Apple Music returns artist/album IDs in several different shapes
  // depending on the response (catalog / charts / library / search).
  // Try every known location so "click artist name" / "click album"
  // works regardless of where this row was rendered from.
  const artistId: string | undefined =
    track.relationships?.artists?.data?.[0]?.id ||
    track.relationships?.artist?.data?.[0]?.id ||
    attrs.artistId ||
    (typeof attrs.artistUrl === 'string'
      ? attrs.artistUrl.match(/\/artist\/[^/]+\/(\d+)/)?.[1]
      : undefined)
  const albumId: string | undefined =
    track.relationships?.albums?.data?.[0]?.id ||
    track.relationships?.album?.data?.[0]?.id ||
    attrs.playParams?.albumId ||
    attrs.albumId ||
    (typeof attrs.url === 'string'
      ? attrs.url.match(/\/album\/[^/]+\/(\d+)/)?.[1]
      : undefined)

  const handleContextMenu = (e: React.MouseEvent) => {
    contextMenu.open(e, trackContextItems(track, { navigate, onPlay }))
  }

  // Artist/album are clickable EVERYWHERE: if the row already carries the id
  // we link instantly; otherwise resolve it on click (search / liked / chart
  // rows often arrive without relationships) and then navigate.
  const goArtist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (artistId) return navigate(`/artist/${artistId}`)
    if (/^i\./i.test(catalogId)) return
    try {
      const { artistId: rid } = await resolveTrackTargets(catalogId)
      if (rid) navigate(`/artist/${rid}`)
    } catch {}
  }
  const goAlbum = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (albumId) return navigate(`/album/${albumId}`)
    if (/^i\./i.test(catalogId)) return
    try {
      const { albumId: rid } = await resolveTrackTargets(catalogId)
      if (rid) navigate(`/album/${rid}`)
    } catch {}
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={clsx(
        'row-hover group grid items-center gap-4 px-3 py-2 rounded-xl cursor-pointer',
        showArt
          ? showAlbum
            ? 'grid-cols-[32px_48px_minmax(0,3fr)_minmax(0,2fr)_32px_60px]'
            : 'grid-cols-[32px_48px_minmax(0,1fr)_32px_60px]'
          : showAlbum
            ? 'grid-cols-[32px_minmax(0,3fr)_minmax(0,2fr)_32px_60px]'
            : 'grid-cols-[32px_minmax(0,1fr)_32px_60px]',
      )}
      onDoubleClick={onPlay}
    >
      <div className="text-[13px] text-obsidian-400 font-mono text-center">
        <span className={clsx('group-hover:hidden', isActive && 'accent-text font-semibold')}>
          {isActive && isPlaying ? '▶' : index + 1}
        </span>
        <button
          className="hidden group-hover:inline-flex accent-text"
          onClick={onPlay}
          aria-label="Play"
        >
          <Play size={14} fill="currentColor" />
        </button>
      </div>
      {showArt && <Artwork src={art} size="sm" alt={title} />}
      <div className="min-w-0">
        <div
          className={clsx(
            'truncate text-[13.5px] font-medium flex items-center gap-1.5',
            isActive ? 'accent-text' : 'text-cream',
          )}
        >
          <span className="truncate">{title}</span>
          {attrs.contentRating === 'explicit' && <ExplicitBadge />}
        </div>
        <div className="truncate text-[12px] text-obsidian-300">
          {artist && (
            <button onClick={goArtist} className="hover:text-cream hover:underline text-left max-w-full truncate">
              {artist}
            </button>
          )}
        </div>
      </div>
      {showAlbum && (
        <div className="truncate text-[12px] text-obsidian-300 hidden md:block">
          {album && (
            <button onClick={goAlbum} className="hover:text-cream hover:underline text-left max-w-full truncate">
              {album}
            </button>
          )}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); toggleLike(catalogId) }}
        className={clsx(
          'opacity-0 group-hover:opacity-100 transition',
          liked && 'opacity-100 accent-text',
          !liked && 'text-obsidian-400 hover:text-cream',
        )}
        title={liked ? 'Unlove' : 'Love'}
      >
        <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
      </button>
      <div className="text-[12px] text-obsidian-400 font-mono text-right tabular-nums">
        {formatDuration(duration)}
      </div>
    </div>
  )
}

/**
 * Tiny "E" pill that mirrors Apple Music's explicit badge — sits inline
 * to the right of the track title. Stays visible when the user has
 * explicit content ALLOWED; if they've turned it off, the row that
 * would carry this badge is filtered out at the parent and never
 * renders in the first place.
 */
function ExplicitBadge() {
  return (
    <span
      title="Explicit"
      className="flex-shrink-0 inline-flex items-center justify-center w-[15px] h-[15px] rounded-[3px] bg-cream/15 text-cream/85 text-[9px] font-bold leading-none tracking-tight"
    >
      E
    </span>
  )
}
