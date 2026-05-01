import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Artwork } from './Artwork'
import { artworkUrl, clsx } from '../utils/format'

interface Props {
  item: any
  onPlay?: () => void
  roundedArtwork?: boolean
  size?: 'sm' | 'md' | 'lg'
}

function routeFor(item: any): string {
  const type = String(item.type ?? '')
  // Library items sometimes carry their catalog id in playParams.catalogId
  const catalogId = item.attributes?.playParams?.catalogId || item.id
  if (type.includes('album')) return `/album/${catalogId}`
  if (type.includes('playlist')) return `/playlist/${catalogId}`
  if (type.includes('station')) return '#'
  return '#'
}

export function MediaCard({ item, onPlay, roundedArtwork = false, size = 'md' }: Props) {
  const attrs = item.attributes ?? {}
  const art = artworkUrl(attrs.artwork?.url, 600)
  const title = attrs.name
  const subtitle = attrs.artistName ?? attrs.curatorName ?? attrs.editorialNotes?.standard ?? ''
  const to = routeFor(item)
  // Catalog responses sometimes carry the artist id at relationships.artists.data[0]
  // — use it to make the subtitle a profile link.
  const artistId =
    item.relationships?.artists?.data?.[0]?.id ||
    item.relationships?.artist?.data?.[0]?.id ||
    (typeof attrs.artistUrl === 'string'
      ? attrs.artistUrl.match(/\/artist\/[^/]+\/(\d+)/)?.[1]
      : undefined)

  return (
    <Link
      to={to}
      className={clsx(
        'group block rounded-xl transition',
        size === 'sm' ? 'p-2' : 'p-3',
        'hover:bg-white/[0.035]',
      )}
    >
      <div className="relative">
        <Artwork
          src={art}
          size="hero"
          rounded={roundedArtwork ? 'full' : 'lg'}
          alt={title}
          className={clsx('shadow-deep', roundedArtwork ? '' : 'shadow-[0_14px_30px_-18px_rgba(0,0,0,0.8)]')}
        />
        {onPlay && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onPlay()
            }}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full accent-bg text-obsidian-950 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition shadow-glow flex items-center justify-center"
            aria-label="Play"
          >
            <Play size={15} fill="currentColor" className="translate-x-[1px]" />
          </button>
        )}
      </div>
      <div className={clsx('mt-3 truncate font-semibold text-white flex items-center gap-1.5', size === 'lg' ? 'text-[14.5px]' : 'text-[13px]')}>
        <span className="truncate">{title}</span>
        {attrs.contentRating === 'explicit' && (
          <span
            title="Explicit"
            className="flex-shrink-0 inline-flex items-center justify-center w-[15px] h-[15px] rounded-[3px] bg-cream/15 text-cream/85 text-[9px] font-bold leading-none tracking-tight"
          >
            E
          </span>
        )}
      </div>
      {subtitle && (
        <div className="truncate text-[12px] text-obsidian-300 mt-0.5">
          {artistId && attrs.artistName ? (
            <Link
              to={`/artist/${artistId}`}
              className="hover:text-cream hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {subtitle}
            </Link>
          ) : (
            subtitle
          )}
        </div>
      )}
    </Link>
  )
}
