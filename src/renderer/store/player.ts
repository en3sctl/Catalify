import { create } from 'zustand'
import { getMusicKit, loveSong, unloveSong } from '../utils/musickit-api'

export interface NowPlayingItem {
  id: string
  title: string
  artistName: string
  albumName: string
  artworkUrl?: string
  durationMs: number
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
