import { Play, Heart } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayer } from '../store/player'
import { Artwork } from './Artwork'
import { artworkUrl, clsx, formatDuration } from '../utils/format'
import { useContextMenu } from './ContextMenuProvider'
import { trackContextItems } from '../utils/track-actions'

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

  const handleContextMenu = (e: React.MouseEvent) => {
    contextMenu.open(e, trackContextItems(track, { navigate, onPlay }))
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
        <div className={clsx('truncate text-[13.5px] font-medium', isActive ? 'accent-text' : 'text-cream')}>
          {title}
        </div>
        <div className="truncate text-[12px] text-obsidian-300">
          {attrs.artistId ? (
            <Link
              to={`/artist/${attrs.artistId}`}
              className="hover:text-cream hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {artist}
            </Link>
          ) : artist}
        </div>
      </div>
      {showAlbum && (
        <div className="truncate text-[12px] text-obsidian-300 hidden md:block">{album}</div>
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
