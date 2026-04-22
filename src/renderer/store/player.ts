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
 * Fisher–Yates shuffle. Exported so `musickit-api.ts` can pre-shuffle the
 * queue it hands to MusicKit. Returns a new array; leaves input untouched.
 */
export function fisherYates<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Rapid next/previous spam used to stack up concurrent
// `changeToMediaAtIndex` promises inside MusicKit and eventually freeze
// the renderer. A 120 ms in-flight lock plus trailing cooldown
// de-duplicates back-to-back clicks without feeling laggy.
let navInFlight = false
let navLastAt = 0
const NAV_COOLDOWN_MS = 120

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
   * Client-managed "up next" — IDs of tracks we expect to play AFTER the
   * current one, in the order we intend to play them. Shuffle state lives
   * here (we reshuffle on toggle), not in MusicKit's opaque internal queue.
   */
  upNextIds: string[]
  /**
   * History stack of previously-played catalog IDs in chronological order.
   * Tail = most recent. Drives the "previous" button when shuffle is on
   * (otherwise a random replay would feel broken).
   */
  playedIds: string[]
  sleepTimerMs: number | null // epoch ms when playback should stop
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
  /** Seed a fresh queue context after a setQueue from playSongs/Album/Playlist. */
  seedQueue: (upNextIds: string[]) => void
  /**
   * Called from the `nowPlayingItemDidChange` MusicKit event. Moves the old
   * current to `playedIds` or pops from `playedIds`, depending on whether the
   * new track is the expected forward/backward neighbour.
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
  upNextIds: [],
  playedIds: [],
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
    // Shuffle is managed ENTIRELY client-side. We keep MusicKit's internal
    // shuffleMode off so that when the user clicks a specific song it plays
    // THAT song (MusicKit's own shuffle re-randomises the queue after
    // setQueue, which was the "shuffle on → click plays random" bug).
    try {
      const mk = getMusicKit()
      mk.shuffleMode = 0
    } catch {}
    // Re-order the remaining queue so natural advance + hitting "next" both
    // respect the new shuffle preference. We don't retain the original
    // unshuffled order when turning shuffle off — Spotify/Apple Music don't
    // either; the "upcoming" list just stays in whatever order it's in.
    if (v && current.upNextIds.length > 1) {
      set({ upNextIds: fisherYates(current.upNextIds) })
    }
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
  seedQueue: (upNextIds) => set({ upNextIds, playedIds: [] }),
  advanceToTrack: (newId) => {
    const { upNextIds, playedIds, nowPlaying } = get()
    const previousId = nowPlaying?.id
    if (!previousId || previousId === newId) return
    const expectedNext = upNextIds[0]
    const mostRecentPlayed = playedIds[playedIds.length - 1]
    if (expectedNext === newId) {
      // Natural forward motion (auto-advance or user "next")
      set({
        upNextIds: upNextIds.slice(1),
        playedIds: [...playedIds, previousId],
      })
    } else if (mostRecentPlayed === newId) {
      // User hit "previous" — push current back onto upNext, pop from played.
      set({
        upNextIds: [previousId, ...upNextIds],
        playedIds: playedIds.slice(0, -1),
      })
    } else {
      // Arbitrary jump (double-click in Queue drawer, Play from album, etc).
      // Treat like a forward motion but also drop `newId` from anywhere it
      // may have lived in upNext so it doesn't play twice.
      set({
        upNextIds: upNextIds.filter((id) => id !== newId),
        playedIds: [...playedIds, previousId],
      })
    }
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
    // Mirror to Apple Music Love rating so the ❤ syncs across devices
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
      const mk = getMusicKit()
      const { shuffle, upNextIds } = get()
      const items = Array.isArray(mk.queue?.items) ? mk.queue.items : []
      const currentIdx = mk.nowPlayingItemIndex ?? -1
      // Client-side shuffle: the NEXT id is whatever sits at upNextIds[0]
      // (already Fisher–Yates-randomised at setQueue time). Find it in
      // MusicKit's queue and jump there. `advanceToTrack` (fired from the
      // nowPlayingItemDidChange event) then updates played/upNext.
      //
      // Defensive checks: (a) idx < 0 means our client state drifted
      // from MusicKit's queue (e.g. queue was replaced by an autoplay
      // station) — fall through to skipToNextItem. (b) idx === currentIdx
      // would restart the CURRENT song, which is exactly the "hitting
      // next snaps me back to the song I was on" bug; also fall through.
      if (shuffle && upNextIds.length > 0) {
        const nextId = upNextIds[0]
        const idx = items.findIndex((it: any) => String(it?.id ?? '') === nextId)
        if (
          idx >= 0 &&
          idx !== currentIdx &&
          typeof mk.changeToMediaAtIndex === 'function'
        ) {
          await mk.changeToMediaAtIndex(idx)
          return
        }
        if (idx < 0 || idx === currentIdx) {
          // Drop the stale / self-referential head so subsequent nexts
          // can make progress instead of looping on the same id.
          set({ upNextIds: upNextIds.slice(1) })
        }
      }
      await mk.skipToNextItem()
    } catch (e) {
      console.error(e)
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
      const { progressMs, shuffle, playedIds } = get()
      const mk = getMusicKit()
      if (progressMs > 3000) {
        await mk.seekToTime(0)
        return
      }
      // Shuffle "previous" pops from the history stack — the song the
      // user actually just heard, not a random re-roll.
      if (shuffle && playedIds.length > 0) {
        const prevId = playedIds[playedIds.length - 1]
        const items = Array.isArray(mk.queue?.items) ? mk.queue.items : []
        const currentIdx = mk.nowPlayingItemIndex ?? -1
        const idx = items.findIndex((it: any) => String(it?.id ?? '') === prevId)
        if (
          idx >= 0 &&
          idx !== currentIdx &&
          typeof mk.changeToMediaAtIndex === 'function'
        ) {
          await mk.changeToMediaAtIndex(idx)
          return
        }
        if (idx < 0 || idx === currentIdx) {
          set({ playedIds: playedIds.slice(0, -1) })
        }
      }
      await mk.skipToPreviousItem()
    } catch (e) {
      console.error(e)
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
