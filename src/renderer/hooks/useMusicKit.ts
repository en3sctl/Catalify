import { useEffect } from 'react'
import { configureMusicKit, getMusicKit, friendlyPlaybackError } from '../utils/musickit-api'
import { usePlayer, NowPlayingItem } from '../store/player'
import { artworkUrl } from '../utils/format'
import { toast } from '../store/toast'
import { diagnoseDRM } from '../utils/drm-check'

function toNowPlaying(item: any): NowPlayingItem | null {
  if (!item) return null
  const attrs = item.attributes ?? {}
  // MusicKit hands us the artist id in different places depending on
  // where the queue was seeded from: catalog tracks expose
  // `relationships.artists.data[0].id`, library tracks sometimes only
  // have `attributes.artistUrl` we can parse, and search-result hits
  // occasionally drop both. Try every shape, tolerate failure.
  const relArtistId =
    item.relationships?.artists?.data?.[0]?.id ||
    item.relationships?.artist?.data?.[0]?.id
  let parsedArtistId: string | undefined
  if (!relArtistId && typeof attrs.artistUrl === 'string') {
    const m = attrs.artistUrl.match(/\/artist\/[^/]+\/(\d+)/)
    if (m) parsedArtistId = m[1]
  }
  return {
    id: item.id,
    title: attrs.name ?? 'Unknown',
    artistName: attrs.artistName ?? '',
    artistId: relArtistId || parsedArtistId,
    albumName: attrs.albumName ?? '',
    artworkUrl: artworkUrl(attrs.artwork?.url, 600),
    durationMs: attrs.durationInMillis ?? 0,
    contentRating: attrs.contentRating,
  }
}

/**
 * Configures MusicKit, restores persisted settings, and binds MusicKit events
 * into the Zustand store. Mount this once, at the root.
 */
export function useMusicKit() {
  useEffect(() => {
    let unbind: (() => void) | null = null
    let progressTimer: number | null = null
    let mounted = true

    ;(async () => {
      try {
        // Fire DRM diagnostic early — if Widevine is missing, user will see a toast
        diagnoseDRM({ silentOnSuccess: true }).catch(() => {})

        const mk = await configureMusicKit()
        if (!mounted) return

        // Restore persisted settings
        const [vol, shuffle, repeat] = await Promise.all([
          window.bombo.store.get<number>('volume'),
          window.bombo.store.get<boolean>('shuffle'),
          window.bombo.store.get<'none' | 'one' | 'all'>('repeat'),
        ])
        if (typeof vol === 'number') {
          mk.volume = vol
          usePlayer.getState().setVolume(vol)
        }
        if (typeof shuffle === 'boolean') {
          usePlayer.setState({ shuffle })
        }
        // Shuffle is client-side only — keep MusicKit's internal mode off
        // so it doesn't second-guess the order we hand to setQueue.
        try { mk.shuffleMode = 0 } catch {}
        if (repeat) {
          mk.repeatMode = repeat === 'none' ? 0 : repeat === 'one' ? 1 : 2
          usePlayer.setState({ repeat })
        }

        usePlayer.getState().setReady(true)
        usePlayer.getState().setAuthorized(!!mk.isAuthorized)

        const onNowPlayingChange = () => {
          const item = mk.nowPlayingItem
          const newNp = toNowPlaying(item)
          // Keep the client-side played/upNext stacks coherent with reality
          // BEFORE we flip nowPlaying, so advanceToTrack can still read
          // "previousId" from the store. This runs on both user-triggered
          // (next/previous/changeToMediaAtIndex) and MusicKit-auto advances.
          if (newNp?.id) {
            usePlayer.getState().advanceToTrack(newNp.id)
          }
          usePlayer.getState().setNowPlaying(newNp)
          usePlayer.getState().setDuration(item?.attributes?.durationInMillis ?? 0)
        }
        const onPlaybackStateChange = ({ state }: { state: number }) => {
          // 1 = loading, 2 = playing, 3 = paused, 4 = stopped, 5 = ended,
          // 8 = waiting/buffering, 10 = completed
          usePlayer.getState().setPlaying(state === 2)
          usePlayer.getState().setBuffering(state === 1 || state === 8)
          // Track finished naturally. Under our single-song queue
          // architecture MusicKit won't auto-advance (the queue literally
          // has one item), so we drive the hand-off from here when our
          // client queue has something after the current head. Otherwise
          // let MusicKit's autoplay extend the session.
          if (state === 5 || state === 10) {
            if (usePlayer.getState().playbackQueue.length > 1) {
              usePlayer.getState().next().catch((err) => console.error('[auto-advance]', err))
            }
          }
        }
        const onPlaybackTimeChange = ({ currentPlaybackTime }: { currentPlaybackTime: number }) => {
          usePlayer.getState().setProgress(Math.round(currentPlaybackTime * 1000))
        }
        const onAuthChange = () => {
          usePlayer.getState().setAuthorized(!!mk.isAuthorized)
        }

        const onPlaybackError = (ev: any) => {
          const err = ev?.error ?? ev?.detail ?? ev
          const raw = [
            err?.errorCode,
            err?.code,
            err?.message,
            err?.name,
            err?.error?.errorCode,
            err?.error?.code,
            err?.error?.message,
            ev?.errorCode,
            ev?.code,
            ev?.message,
          ].find((v) => typeof v === 'string' && v.trim().length > 0) ||
          (() => {
            try { return JSON.stringify(err) } catch { return String(err) }
          })() ||
          'Unknown playback error'
          const queueItems = Array.isArray(mk.queue?.items) ? mk.queue.items : []
          const first = queueItems[0]
          const firstId = String(first?.id ?? '')
          const firstType = String(first?.type ?? '')
          const firstPlayParams = first?.attributes?.playParams
          const diagnostic = {
            raw,
            storefrontId: mk.storefrontId,
            isAuthorized: mk.isAuthorized,
            hasMusicUserToken: !!mk.musicUserToken,
            queueLength: queueItems.length,
            firstId,
            firstType,
            firstPlayParams,
          }
          console.error('[mediaPlaybackError:diagnostic]', diagnostic)
          try {
            console.error('[mediaPlaybackError:diagnostic:json]', JSON.stringify(diagnostic))
          } catch {}

          if (/UNKNOWN_ERROR/i.test(String(raw)) && /^i\./i.test(firstId)) {
            toast.error(
              'Playback failed',
              'Queue has library-only tracks (id starts with i.) that MusicKit JS cannot stream directly. Try playing from Search/catalog.',
            )
            return
          }
          console.error('[mediaPlaybackError]', err)
          toast.error('Playback failed', friendlyPlaybackError(String(raw)))
        }

        mk.addEventListener('nowPlayingItemDidChange', onNowPlayingChange)
        mk.addEventListener('playbackStateDidChange', onPlaybackStateChange)
        mk.addEventListener('playbackTimeDidChange', onPlaybackTimeChange)
        mk.addEventListener('authorizationStatusDidChange', onAuthChange)
        mk.addEventListener('mediaPlaybackError', onPlaybackError)
        mk.addEventListener('playbackError', onPlaybackError)

        // Fallback progress tick in case timeDidChange is throttled.
        // 150 ms is smooth enough for the lyrics karaoke fill while still
        // cheap (Zustand only re-renders slices that actually changed).
        progressTimer = window.setInterval(() => {
          if (mk.isPlaying) {
            usePlayer.getState().setProgress(Math.round((mk.currentPlaybackTime ?? 0) * 1000))
          }
        }, 150)

        unbind = () => {
          mk.removeEventListener('nowPlayingItemDidChange', onNowPlayingChange)
          mk.removeEventListener('playbackStateDidChange', onPlaybackStateChange)
          mk.removeEventListener('playbackTimeDidChange', onPlaybackTimeChange)
          mk.removeEventListener('authorizationStatusDidChange', onAuthChange)
          mk.removeEventListener('mediaPlaybackError', onPlaybackError)
          mk.removeEventListener('playbackError', onPlaybackError)
        }

        // Initialise state if something is already queued
        onNowPlayingChange()
      } catch (err) {
        console.error('MusicKit initialization failed:', err)
      }
    })()

    // Global shortcut bridge
    const offShortcut = window.bombo.onShortcut((action) => {
      const p = usePlayer.getState()
      if (action === 'toggle') p.toggle()
      if (action === 'next') p.next()
      if (action === 'previous') p.previous()
    })

    return () => {
      mounted = false
      if (progressTimer) window.clearInterval(progressTimer)
      unbind?.()
      offShortcut?.()
    }
  }, [])
}
