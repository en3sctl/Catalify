import { create } from 'zustand'
import {
  addToLibrary,
  favoriteArtist,
  getMusicKit,
  loveSong,
  unfavoriteArtist,
  unloveSong,
} from '../utils/musickit-api'
import { toast } from './toast'

export interface NowPlayingItem {
  id: string
  title: string
  artistName: string
  /** Apple catalog artist id, if MusicKit surfaced one — drives the
   *  "tap artist name to open profile" links in the bar / full player. */
  artistId?: string
  albumName: string
  artworkUrl?: string
  durationMs: number
  /** "explicit" | "clean" | undefined. Lets us pause/skip the current
   *  track if the user toggles "Allow explicit content" off mid-playback. */
  contentRating?: string
}

/**
 * An entry in `playbackQueue`. `priority: true` marks a track the user
 * inserted via "Play Next" / "Add to Queue" — it survives shuffle toggles
 * (kept as a block right after the current track) and can't be wiped by
 * a re-shuffle of the source pool.
 */
export interface QueueItem {
  id: string
  priority?: boolean
}

export function fisherYates<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Smart shuffle — Fisher–Yates first pass, then greedy spread so the same
 * artist doesn't stack two-in-a-row. Falls back to plain Fisher–Yates if
 * we don't have artist metadata for the pool (station / radio contexts).
 */
export function smartShuffle(ids: string[], artistMap?: Record<string, string>): string[] {
  const shuffled = fisherYates(ids)
  if (!artistMap || ids.length < 4) return shuffled
  const result: string[] = []
  const pending = shuffled.slice()
  while (pending.length > 0) {
    const lastArtist = result.length > 0 ? artistMap[result[result.length - 1]] : undefined
    const secondLastArtist = result.length > 1 ? artistMap[result[result.length - 2]] : undefined
    let pickIdx = pending.findIndex((id) => {
      const a = artistMap[id]
      if (!a) return true
      return a !== lastArtist && a !== secondLastArtist
    })
    if (pickIdx < 0) pickIdx = 0
    result.push(pending[pickIdx])
    pending.splice(pickIdx, 1)
  }
  return result
}

let navInFlight = false
let navLastAt = 0
const NAV_COOLDOWN_MS = 120

async function setQueueWithTimeout(mk: any, songId: string, timeoutMs = 5000): Promise<void> {
  await Promise.race([
    mk.setQueue({ song: songId }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`setQueue timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
}

interface PlayerState {
  isReady: boolean
  isAuthorized: boolean
  isPlaying: boolean
  isBuffering: boolean
  nowPlaying: NowPlayingItem | null
  progressMs: number
  durationMs: number
  volume: number
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'
  /**
   * The untouched source order of the current playback context (album /
   * playlist / library list). Never mutated after seed — shuffle-off
   * rebuilds `playbackQueue` from this so we can un-shuffle coherently.
   */
  originalPlaylist: string[]
  /**
   * The live queue. `playbackQueue[0]` is the currently playing track;
   * `playbackQueue[1..]` is what the user sees as "Up next". Entries
   * flagged `priority: true` are user-added (Play Next / Add to Queue)
   * and are preserved across shuffle toggles.
   */
  playbackQueue: QueueItem[]
  /**
   * Chronological history of track IDs the user has finished listening
   * to (tail = most recent). Drives the Previous button.
   */
  playedIds: string[]
  /**
   * Optional id → artistName map for the current source. Fed by
   * playAlbum / playPlaylist when the MusicKit response gives us artist
   * names for free. Used by `smartShuffle` to avoid artist clustering.
   */
  sourceArtists: Record<string, string>
  sleepTimerMs: number | null
  likedIds: Record<string, boolean>
  /**
   * "Allow explicit content" preference. When false, every list in
   * the app filters tracks/albums whose Apple `contentRating` is
   * `'explicit'`, and the queue won't pick them up either. Persists
   * under `settings.allowExplicit`.
   */
  allowExplicit: boolean
  /**
   * Catalog IDs of albums / artists / playlists the user has saved into
   * their Apple Music library from inside Çatalify. Synced TO Apple via
   * `addToLibrary()` and FROM Apple on every Library page load. Lets us
   * render "Saved" / "Added" state instantly without re-fetching the
   * library on every Album / Artist visit.
   */
  librarySaved: { albums: Record<string, boolean>; artists: Record<string, boolean> }

  setReady: (v: boolean) => void
  setAuthorized: (v: boolean) => void
  setNowPlaying: (item: NowPlayingItem | null) => void
  setProgress: (ms: number) => void
  setDuration: (ms: number) => void
  setPlaying: (v: boolean) => void
  setBuffering: (v: boolean) => void
  setVolume: (v: number) => void
  setShuffle: (v: boolean) => void
  setRepeat: (v: 'none' | 'one' | 'all') => void
  setSleepTimer: (minutes: number | null) => void
  toggleLike: (id: string) => void
  setLiked: (map: Record<string, boolean>) => void
  setAllowExplicit: (v: boolean) => void
  /**
   * Save / unsave a catalog item from the user's Apple Music library.
   * Optimistic — local state flips immediately, the network call runs
   * after; on failure the state is rolled back via the toast.
   */
  toggleLibraryAlbum: (id: string, albumSnapshot?: any) => Promise<void>
  toggleLibraryArtist: (id: string) => Promise<void>
  setLibrarySaved: (kind: 'albums' | 'artists', map: Record<string, boolean>) => void
  /**
   * Seed a fresh playback context after a MusicKit setQueue. `startId`
   * becomes `playbackQueue[0]`; the rest of the queue is derived from
   * `originalPlaylist` respecting the current shuffle flag. `artistMap`
   * is optional — present for album/playlist, absent for ad-hoc lists.
   */
  seedQueue: (originalPlaylist: string[], startId: string, artistMap?: Record<string, string>) => void
  /**
   * Reconcile store with an external nowPlaying change (MusicKit autoplay,
   * manual jump in Queue drawer, etc). Cheap no-op when the optimistic
   * update already aligned things.
   */
  advanceToTrack: (newId: string) => void

  play: () => Promise<void>
  pause: () => Promise<void>
  toggle: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (ms: number) => Promise<void>
  cycleRepeat: () => void
  toggleShuffle: () => void
}

/**
 * Rebuild `playbackQueue` around a fixed current track, following the
 * shuffle flag. Priority entries (user-added) are preserved as a block
 * right after the current track.
 */
function buildQueue(opts: {
  originalPlaylist: string[]
  currentId: string | null
  shuffle: boolean
  priorityItems: QueueItem[]
  artistMap?: Record<string, string>
}): QueueItem[] {
  const { originalPlaylist, currentId, shuffle, priorityItems, artistMap } = opts
  const head: QueueItem[] = currentId ? [{ id: currentId }] : []
  const priorityIds = new Set(priorityItems.map((p) => p.id))
  const remaining = originalPlaylist.filter((id) => id !== currentId && !priorityIds.has(id))
  const tail = shuffle
    ? smartShuffle(remaining, artistMap)
    : currentId
      ? (() => {
          const idx = originalPlaylist.indexOf(currentId)
          if (idx < 0) return remaining
          return originalPlaylist.slice(idx + 1).filter((id) => !priorityIds.has(id))
        })()
      : remaining
  return [...head, ...priorityItems, ...tail.map((id) => ({ id }))]
}

export const usePlayer = create<PlayerState>((set, get) => ({
  isReady: false,
  isAuthorized: false,
  isPlaying: false,
  isBuffering: false,
  nowPlaying: null,
  progressMs: 0,
  durationMs: 0,
  volume: 0.8,
  shuffle: false,
  repeat: 'none',
  originalPlaylist: [],
  playbackQueue: [],
  playedIds: [],
  sourceArtists: {},
  sleepTimerMs: null,
  likedIds: {},
  librarySaved: { albums: {}, artists: {} },
  allowExplicit: true,

  setReady: (v) => set({ isReady: v }),
  setAuthorized: (v) => set({ isAuthorized: v }),
  setNowPlaying: (item) => set({ nowPlaying: item }),
  setProgress: (ms) => {
    set({ progressMs: ms })
    const s = get().sleepTimerMs
    if (s && Date.now() >= s) {
      try { getMusicKit().pause() } catch {}
      set({ sleepTimerMs: null })
    }
  },
  setDuration: (ms) => set({ durationMs: ms }),
  setPlaying: (v) => set({ isPlaying: v }),
  setBuffering: (v) => set({ isBuffering: v }),
  setVolume: (v) => {
    set({ volume: v })
    try {
      getMusicKit().volume = v
    } catch {}
    window.bombo.store.set('volume', v)
  },
  setShuffle: (v) => {
    const current = get()
    if (current.shuffle === v) return
    set({ shuffle: v })
    // MusicKit's own shuffleMode stays off — we manage everything
    // client-side so "click song → play that exact song" never gets
    // re-rolled by MusicKit after setQueue.
    try {
      const mk = getMusicKit()
      mk.shuffleMode = 0
    } catch {}
    const currentId = current.playbackQueue[0]?.id ?? current.nowPlaying?.id ?? null
    if (current.originalPlaylist.length === 0) {
      // No source tracked (station / single-song radio) — nothing to
      // re-sequence. Leave the queue alone.
      window.bombo.store.set('shuffle', v)
      return
    }
    const priorityItems = current.playbackQueue.slice(1).filter((it) => it.priority)
    const nextQueue = buildQueue({
      originalPlaylist: current.originalPlaylist,
      currentId,
      shuffle: v,
      priorityItems,
      artistMap: current.sourceArtists,
    })
    set({ playbackQueue: nextQueue })
    window.bombo.store.set('shuffle', v)
  },
  setRepeat: (v) => {
    set({ repeat: v })
    try {
      const mk = getMusicKit()
      const mode = (window as any).MusicKit?.PlayerRepeatMode
      if (v === 'none') mk.repeatMode = mode?.none ?? 0
      else if (v === 'one') mk.repeatMode = mode?.one ?? 1
      else mk.repeatMode = mode?.all ?? 2
    } catch {}
    window.bombo.store.set('repeat', v)
  },
  seedQueue: (originalPlaylist, startId, artistMap) => {
    const shuffle = get().shuffle
    const queue = buildQueue({
      originalPlaylist,
      currentId: startId,
      shuffle,
      priorityItems: [],
      artistMap,
    })
    set({
      originalPlaylist,
      playbackQueue: queue,
      playedIds: [],
      sourceArtists: artistMap ?? {},
    })
  },
  advanceToTrack: (newId) => {
    const state = get()
    const { playbackQueue, playedIds } = state
    // Optimistic path hit: next()/previous() already reshuffled the
    // queue before calling setQueue. Nothing to do here.
    if (playbackQueue[0]?.id === newId) return

    // Track appears downstream in the queue — user skipped ahead
    // (or Apple autoplay jumped forward). Move everything between
    // index 0 and newId into playedIds.
    const forwardIdx = playbackQueue.findIndex((it, i) => i > 0 && it.id === newId)
    if (forwardIdx > 0) {
      const consumed = playbackQueue.slice(0, forwardIdx).map((it) => it.id)
      set({
        playbackQueue: playbackQueue.slice(forwardIdx),
        playedIds: [...playedIds, ...consumed],
      })
      return
    }

    // Track is in history — user went backwards through something we
    // didn't route through previous(). Pop history back onto the queue.
    const historyIdx = playedIds.lastIndexOf(newId)
    if (historyIdx >= 0) {
      const reinsert = playedIds.slice(historyIdx + 1).reverse()
      const nextQueue: QueueItem[] = [
        { id: newId },
        ...reinsert.map((id) => ({ id })),
        ...playbackQueue,
      ]
      set({
        playbackQueue: nextQueue,
        playedIds: playedIds.slice(0, historyIdx),
      })
      return
    }

    // External jump (station autoplay surfacing a brand-new track,
    // search → play of something not in our context). Demote the old
    // head to played, install newId as the new head.
    const oldHead = playbackQueue[0]
    set({
      playbackQueue: [{ id: newId }, ...playbackQueue.slice(1)],
      playedIds: oldHead ? [...playedIds, oldHead.id] : playedIds,
    })
  },

  setSleepTimer: (minutes) => {
    const at = minutes ? Date.now() + minutes * 60_000 : null
    set({ sleepTimerMs: at })
  },

  toggleLike: (id) => {
    const next = { ...get().likedIds }
    const wasLiked = !!next[id]
    if (wasLiked) delete next[id]
    else next[id] = true
    set({ likedIds: next })
    window.bombo.store.set('likedIds', next)
    ;(wasLiked ? unloveSong(id) : loveSong(id)).catch((err) =>
      console.warn('Love sync failed for', id, err)
    )
  },
  setLiked: (map) => set({ likedIds: map }),
  setAllowExplicit: (v) => {
    set({ allowExplicit: v })
    window.bombo.store.set('settings.allowExplicit', v)
    // If the user just turned the filter OFF and the currently playing
    // track is explicit, stop it. We pause rather than auto-skip — the
    // queue beneath might be all explicit too, and silently chaining
    // skips through 10 tracks would feel like the player broke. The
    // toast tells them what happened so they can pick something else.
    if (!v) {
      const np = get().nowPlaying
      if (np?.contentRating === 'explicit') {
        try {
          getMusicKit().pause()
        } catch {}
        toast.info(
          'Paused',
          `"${np.title}" is marked explicit. Pick another track or turn the setting back on.`,
        )
      }
    }
  },

  toggleLibraryAlbum: async (id, albumSnapshot) => {
    const current = get().librarySaved
    if (current.albums[id]) {
      // Removal needs the library-side ID (Apple's DELETE endpoint takes
      // l.xxxxxxxx, not the catalog id) which means another round-trip
      // we haven't wired yet. Tell the user where to do it for now.
      toast.info(
        'Already in library',
        'Remove it from the official Apple Music app — direct removal isn\'t wired here yet.',
      )
      return
    }
    // Optimistic flip + persist
    const next = {
      ...current,
      albums: { ...current.albums, [id]: true },
    }
    set({ librarySaved: next })
    window.bombo.store.set('librarySaved', next)
    try {
      await addToLibrary('albums', id)
      // Apple's /v1/me/library/albums response can lag 5–15 minutes
      // behind a successful POST while their CDN cache reindexes. To
      // bridge that window we stash the album snapshot locally; the
      // Library page merges it on top of Apple's response, then Library
      // dedupes once Apple finally surfaces the same id on its side.
      if (albumSnapshot) {
        const existing = (await window.bombo.store.get<any[]>(
          'optimisticLibraryAlbums',
        )) || []
        const dedupe = existing.filter(
          (a) => (a?.attributes?.playParams?.catalogId || a?.id) !== id,
        )
        const stamped = {
          ...albumSnapshot,
          attributes: {
            ...albumSnapshot.attributes,
            // Mark dateAdded NOW so the "Recent" sort puts it on top.
            dateAdded: new Date().toISOString(),
          },
        }
        window.bombo.store.set('optimisticLibraryAlbums', [stamped, ...dedupe])
      }
      toast.info('Added to library')
    } catch (err) {
      console.warn('addToLibrary albums failed', id, err)
      // Roll back on failure
      const rollback = { ...current }
      set({ librarySaved: rollback })
      window.bombo.store.set('librarySaved', rollback)
      toast.error('Couldn\'t add to library', String((err as any)?.message ?? err))
    }
  },

  toggleLibraryArtist: async (id) => {
    const current = get().librarySaved
    const wasFollowing = !!current.artists[id]
    // Optimistic toggle — flip first, sync to Apple after. Apple's
    // favorites endpoint is best-effort: if it fails we keep the local
    // state anyway so the user's Profile / Following grid stay coherent
    // with what they clicked. We only roll back on follow (not unfollow)
    // failures since those are rarer and the user expectation is binary.
    const nextArtists = { ...current.artists }
    if (wasFollowing) delete nextArtists[id]
    else nextArtists[id] = true
    const next = { ...current, artists: nextArtists }
    set({ librarySaved: next })
    window.bombo.store.set('librarySaved', next)
    try {
      if (wasFollowing) await unfavoriteArtist(id)
      else await favoriteArtist(id)
      toast.info(wasFollowing ? 'Unfollowed artist' : 'Following artist')
    } catch (err) {
      // Best-effort: keep local state, just warn. The server might 404
      // /v1/me/favorites on certain storefronts; we'd rather a user see
      // their UI react than block on Apple's intermittent endpoint.
      console.warn('[favorites] artist toggle failed (kept local state)', id, err)
      toast.info(
        wasFollowing ? 'Unfollowed (local only)' : 'Following (local only)',
        'Apple sync skipped — this storefront may not support artist favorites.',
      )
    }
  },

  setLibrarySaved: (kind, map) =>
    set({ librarySaved: { ...get().librarySaved, [kind]: map } }),

  play: async () => {
    try { await getMusicKit().play() } catch (e) { console.error(e) }
  },
  pause: async () => {
    try { await getMusicKit().pause() } catch (e) { console.error(e) }
  },
  toggle: async () => {
    const { isPlaying } = get()
    if (isPlaying) await get().pause()
    else await get().play()
  },
  next: async () => {
    const now = Date.now()
    if (navInFlight || now - navLastAt < NAV_COOLDOWN_MS) return
    navInFlight = true
    navLastAt = now
    try {
      const state = get()
      const { playbackQueue, playedIds, originalPlaylist, repeat, shuffle, sourceArtists } = state
      const mk = getMusicKit()

      if (playbackQueue.length > 1) {
        // Optimistic advance — mutate store BEFORE setQueue so a second
        // rapid next() call can't re-use the same head and restart
        // the song we already advanced past.
        const [oldHead, ...rest] = playbackQueue
        const nextHead = rest[0]
        set({
          playbackQueue: rest,
          playedIds: oldHead ? [...playedIds, oldHead.id] : playedIds,
        })
        await setQueueWithTimeout(mk, nextHead.id, 6000)
        await mk.play().catch(() => {})
        return
      }

      // Single-item queue. If repeat=all and we have a source, loop
      // back to the top by re-seeding from originalPlaylist.
      if (playbackQueue.length === 1 && repeat === 'all' && originalPlaylist.length > 1) {
        const head = originalPlaylist[0]
        const queue = buildQueue({
          originalPlaylist,
          currentId: head,
          shuffle,
          priorityItems: [],
          artistMap: sourceArtists,
        })
        set({
          playbackQueue: queue,
          playedIds: [...playedIds, playbackQueue[0].id],
        })
        await setQueueWithTimeout(mk, head, 6000)
        await mk.play().catch(() => {})
        return
      }

      // Nothing queued — let MusicKit (station/autoplay) try.
      if (typeof mk.skipToNextItem === 'function') {
        await mk.skipToNextItem()
      }
    } catch (e) {
      console.error('[next] failed', e)
    } finally {
      navInFlight = false
    }
  },
  previous: async () => {
    const now = Date.now()
    if (navInFlight || now - navLastAt < NAV_COOLDOWN_MS) return
    navInFlight = true
    navLastAt = now
    try {
      const { progressMs, playedIds, playbackQueue } = get()
      const mk = getMusicKit()
      if (progressMs > 3000) {
        await mk.seekToTime(0).catch(() => {})
        return
      }
      if (playedIds.length > 0) {
        const prevId = playedIds[playedIds.length - 1]
        set({
          playbackQueue: [{ id: prevId }, ...playbackQueue],
          playedIds: playedIds.slice(0, -1),
        })
        await setQueueWithTimeout(mk, prevId, 6000)
        await mk.play().catch(() => {})
        return
      }
      if (typeof mk.skipToPreviousItem === 'function') {
        await mk.skipToPreviousItem()
      }
    } catch (e) {
      console.error('[previous] failed', e)
    } finally {
      navInFlight = false
    }
  },
  seek: async (ms) => {
    try {
      await getMusicKit().seekToTime(ms / 1000)
      set({ progressMs: ms })
    } catch (e) {
      console.error(e)
    }
  },
  cycleRepeat: () => {
    const order: Array<'none' | 'one' | 'all'> = ['none', 'all', 'one']
    const current = get().repeat
    const next = order[(order.indexOf(current) + 1) % order.length]
    get().setRepeat(next)
  },
  toggleShuffle: () => get().setShuffle(!get().shuffle),
}))
