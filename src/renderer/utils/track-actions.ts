import {
  Play,
  Plus,
  ListPlus,
  Disc3,
  User,
  Heart,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import type { NavigateFunction } from 'react-router-dom'
import type { ContextMenuItem } from '../components/ContextMenuProvider'
import { usePlayer } from '../store/player'
import {
  catalogUrl,
  playSongs,
  queuePlayLater,
  queuePlayNext,
} from './musickit-api'
import { toast } from '../store/toast'

// Re-export so callers don't need to know which icon file a helper uses.
export const TrackActionIcons: Record<string, LucideIcon> = {
  Play,
  Plus,
  ListPlus,
  Disc3,
  User,
  Heart,
  LinkIcon,
}

/**
 * Build the right-click menu for a single track row. `navigate` is passed in
 * so we don't depend on react-router-dom here (this helper is imported from
 * both pages and stand-alone components).
 */
export function trackContextItems(
  track: any,
  opts: {
    navigate: NavigateFunction
    onPlay: () => void
  },
): ContextMenuItem[] {
  const attrs = track?.attributes ?? {}
  const catalogId: string = attrs.playParams?.catalogId || track?.id || ''
  const albumId: string | undefined = attrs.playParams?.albumId || attrs.albumId
  const artistId: string | undefined = attrs.artistId
  const likedIds = usePlayer.getState().likedIds
  const liked = !!likedIds[catalogId]

  const items: ContextMenuItem[] = [
    { type: 'item', label: 'Play', icon: Play, onClick: opts.onPlay },
    {
      type: 'item',
      label: 'Play next',
      icon: Plus,
      onClick: () => {
        queuePlayNext(catalogId).catch((err) => console.warn(err))
        toast.info('Added', `"${attrs.name}" will play next`)
      },
      disabled: !catalogId || /^i\./i.test(catalogId),
    },
    {
      type: 'item',
      label: 'Add to queue',
      icon: ListPlus,
      onClick: () => {
        queuePlayLater(catalogId).catch((err) => console.warn(err))
        toast.info('Queued', `"${attrs.name}" added to the queue`)
      },
      disabled: !catalogId || /^i\./i.test(catalogId),
    },
    { type: 'separator' },
    {
      type: 'item',
      label: liked ? 'Remove from Liked' : 'Add to Liked',
      icon: Heart,
      onClick: () => usePlayer.getState().toggleLike(catalogId),
      disabled: !catalogId,
    },
    { type: 'separator' },
    {
      type: 'item',
      label: 'Go to album',
      icon: Disc3,
      onClick: () => opts.navigate(`/album/${albumId}`),
      disabled: !albumId,
    },
    {
      type: 'item',
      label: 'Go to artist',
      icon: User,
      onClick: () => opts.navigate(`/artist/${artistId}`),
      disabled: !artistId,
    },
    { type: 'separator' },
    {
      type: 'item',
      label: 'Copy Apple Music link',
      icon: LinkIcon,
      onClick: async () => {
        const url = await catalogUrl(track)
        if (!url) {
          toast.error('Copy failed', 'Could not build a catalog URL')
          return
        }
        try {
          await navigator.clipboard.writeText(url)
          toast.info('Link copied')
        } catch (err) {
          toast.error('Copy failed', String(err))
        }
      },
    },
  ]

  return items
}

/** Play a single song on its own (used as the default action for rows that
 *  don't carry their own queue context — mostly for context-menu "Play"). */
export function playSongNow(songId: string) {
  if (!songId) return
  return playSongs([songId], 0)
}
