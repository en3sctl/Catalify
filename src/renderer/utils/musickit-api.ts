/**
 * Typed helpers around the MusicKit JS global.
 * All network calls use music.api which auto-attaches developer + user tokens.
 */

export type MKInstance = any

let instance: MKInstance | null = null
let devToken: string | null = null
let readyPromise: Promise<MKInstance> | null = null
let lastMediaLicenseRecoveryAt = 0

export function getMusicKit(): MKInstance {
  if (!instance) throw new Error('MusicKit not configured yet')
  return instance
}

export function getDeveloperToken(): string | null {
  return devToken
}

/**
 * Waits for the global MusicKit script to load, then configures it with a fresh
 * developer token from the Electron main process.
 */
export function configureMusicKit(): Promise<MKInstance> {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    devToken = await window.bombo.getDeveloperToken()
    // Optional override — only used as an initial hint. MusicKit will replace
    // this with the user's real subscription storefront after authorize().
    let envStorefront: string | null = null;
    try {
        envStorefront = await window.bombo.getStorefront();
    } catch (e) {
        envStorefront = null;
    }
    
    await waitForMusicKitGlobal();
    
    const config: any = {
      developerToken: devToken,
      app: { name: 'Catalify', build: '0.1.0' },
      suppressErrorDialog: true,
    }
    if (envStorefront && /^[a-z]{2}$/.test(envStorefront)) {
      config.storefrontId = envStorefront;
    }
    
    await window.MusicKit.configure(config);

    instance = window.MusicKit.getInstance();
    // Prefer standard bitrate first; some Electron/Widevine setups fail license
    // negotiation at higher variants and recover only after a manual downgrade.
    try { instance.bitrate = window.MusicKit.PlaybackBitrate?.STANDARD ?? 128 } catch {}
    // Turn on Apple's native "up next" / autoplay behaviour so that when the
    // explicit queue runs out MusicKit automatically streams related tracks
    // (same as the Apple Music web player's default). Without this, playing a
    // single song ends in silence once the track finishes.
    try { instance.autoplayEnabled = true } catch {}
    console.log(`[MusicKit] configured — initial storefront: ${instance.storefrontId}, authorized: ${instance.isAuthorized}`);

    // After auth, MusicKit updates storefrontId from the user's token.
    // Log the final resolved value so CONTENT_EQUIVALENT errors are easier to debug.
    instance.addEventListener('authorizationStatusDidChange', () => {
      console.log(`[MusicKit] post-auth storefront: ${instance.storefrontId}, authorized: ${instance.isAuthorized}`)
    })

    // Install a fetch interceptor to capture DRM license request/response bodies.
    // The server returns HTTP 200 but the JSON body may contain error details.
    const originalFetch = window.fetch
    window.fetch = async function (...args: any[]) {
      const [input, init] = args
      const url = typeof input === 'string' ? input : input?.url || ''
      const isLicense = url.includes('acquireWebPlaybackLicense') || url.includes('webPlayback')
      if (isLicense) {
        console.log('[DRM-fetch] →', init?.method || 'GET', url.slice(0, 120))
        if (init?.body) {
          try {
            const bodyStr = typeof init.body === 'string' ? init.body : new TextDecoder().decode(init.body as ArrayBuffer)
            // Log first 500 chars of the body to avoid flooding
            console.log('[DRM-fetch] request body:', bodyStr.slice(0, 500))
          } catch {}
        }
      }
      const response = await originalFetch.apply(window, args as any)
      if (isLicense) {
        // Clone the response so we can read the body without consuming it
        const clone = response.clone()
        clone.text().then((body: string) => {
          console.log('[DRM-fetch] ←', response.status, url.slice(0, 80))
          console.log('[DRM-fetch] response body:', body.slice(0, 1000))
        }).catch(() => {})
      }
      return response
    }

    return instance
  })()
  return readyPromise
}

function waitForMusicKitGlobal(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MusicKit) return resolve()
    const start = Date.now()
    const tick = () => {
      if (window.MusicKit) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('MusicKit JS failed to load'))
      setTimeout(tick, 100)
    }
    document.addEventListener('musickitloaded', () => resolve(), { once: true })
    tick()
  })
}

export async function authorize(): Promise<string> {
  const mk = getMusicKit()
  const token = await mk.authorize()
  return token
}

export async function unauthorize(): Promise<void> {
  const mk = getMusicKit()
  await mk.unauthorize()
  await window.bombo.store.delete('userToken')
  await window.bombo.store.delete('apple_loved_ids')
}

export function isAuthorized(): boolean {
  return !!instance?.isAuthorized
}

export async function storefront(): Promise<string> {
  const mk = getMusicKit()
  return mk.storefrontId || 'us'
}

// ——— Catalog helpers ———

export async function search(term: string, types = ['songs', 'albums', 'artists', 'playlists'], limit = 20) {
  const mk = getMusicKit()
  const sf = await storefront()
  const res = await mk.api.music(`/v1/catalog/${sf}/search`, {
    term,
    types: types.join(','),
    limit,
  })
  return res.data.results
}

export async function getAlbum(id: string) {
  const mk = getMusicKit()
  const sf = await storefront()
  const res = await mk.api.music(`/v1/catalog/${sf}/albums/${id}`, {
    include: 'tracks,artists',
  })
  return res.data.data[0]
}

export async function getPlaylist(id: string) {
  const mk = getMusicKit()
  const sf = await storefront()
  const res = await mk.api.music(`/v1/catalog/${sf}/playlists/${id}`, {
    include: 'tracks',
  })
  return res.data.data[0]
}

export async function getArtist(id: string) {
  const mk = getMusicKit()
  const sf = await storefront()
  const res = await mk.api.music(`/v1/catalog/${sf}/artists/${id}`, {
    views: 'top-songs,featured-albums,full-albums,appears-on-albums,similar-artists',
    include: 'albums',
  })
  return res.data.data[0]
}

export async function getStations(limit = 20) {
  const mk = getMusicKit()
  const sf = await storefront()
  const res = await mk.api.music(`/v1/catalog/${sf}/stations`, {
    filter: { featured: 'apple-music-hits' } as any,
    limit,
  }).catch(async () => {
    // Fallback to plain search for stations if featured filter fails
    const s = await mk.api.music(`/v1/catalog/${sf}/search`, {
      term: 'radio',
      types: 'stations',
      limit,
    })
    return { data: { data: s.data.results?.stations?.data ?? [] } }
  })
  return res.data.data ?? []
}

export async function getPersonalStation() {
  const mk = getMusicKit()
  try {
    const res = await mk.api.music(`/v1/me/recommendations`, { limit: 1, types: 'personal-stations' })
    return res.data.data
  } catch {
    return []
  }
}

// ——— Library (requires user auth) ———

export async function getLibraryPlaylists(limit = 50) {
  const mk = getMusicKit()
  const res = await mk.api.music('/v1/me/library/playlists', { limit })
  return res.data.data
}

export async function getLibraryAlbums(limit = 50) {
  const mk = getMusicKit()
  const res = await mk.api.music('/v1/me/library/albums', { limit })
  return res.data.data
}

export async function getLibrarySongs(limit = 100) {
  const mk = getMusicKit()
  const res = await mk.api.music('/v1/me/library/songs', { limit })
  return res.data.data
}

export async function getRecentlyPlayed(limit = 20) {
  const mk = getMusicKit()
  try {
    const res = await mk.api.music('/v1/me/recent/played', { limit })
    return res.data.data ?? []
  } catch (err: any) {
    console.warn('[MusicKit] /v1/me/recent/played unavailable', err?.message || err)
    return []
  }
}

export async function getHeavyRotation(limit = 10) {
  const mk = getMusicKit()
  try {
    const res = await mk.api.music('/v1/me/history/heavy-rotation', { limit })
    return res.data.data ?? []
  } catch (err: any) {
    console.warn('[MusicKit] /v1/me/history/heavy-rotation unavailable', err?.message || err)
    return []
  }
}

export async function getRecommendations(limit = 10) {
  const mk = getMusicKit()
  try {
    const res = await mk.api.music('/v1/me/recommendations', { limit })
    return res.data.data ?? []
  } catch (err: any) {
    console.warn('[MusicKit] /v1/me/recommendations unavailable', err?.message || err)
    return []
  }
}

export async function getLibraryRecentlyAdded(limit = 20) {
  const mk = getMusicKit()
  const res = await mk.api.music('/v1/me/library/recently-added', { limit })
  return res.data.data
}

export async function getCatalogSongsByIds(ids: string[]) {
  if (ids.length === 0) return []
  const mk = getMusicKit()
  const sf = await storefront()
  const batch = ids.slice(0, 300)
  const res = await mk.api.music(`/v1/catalog/${sf}/songs`, { ids: batch.join(',') })
  return res.data.data
}

// ——— Apple Music "Love" rating (syncs the ❤ with user's account) ———

export async function loveSong(songId: string): Promise<void> {
  const mk = getMusicKit()
  await mk.api.music(`/v1/me/ratings/songs/${songId}`, undefined, {
    fetchOptions: {
      method: 'PUT',
      body: JSON.stringify({
        type: 'ratings',
        attributes: { value: 100 },
      }),
    },
  })
}

export async function unloveSong(songId: string): Promise<void> {
  const mk = getMusicKit()
  await mk.api.music(`/v1/me/ratings/songs/${songId}`, undefined, {
    fetchOptions: { method: 'DELETE' },
  })
}

export async function getSongRatings(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {}
  const mk = getMusicKit()
  try {
    const res = await mk.api.music('/v1/me/ratings/songs', {
      ids: ids.slice(0, 100).join(','),
    })
    const map: Record<string, number> = {}
    for (const r of res.data.data ?? []) {
      map[r.id] = r.attributes?.value ?? 0
    }
    return map
  } catch {
    return {}
  }
}

// ——— Add/remove from user's library ———

export async function addToLibrary(type: 'songs' | 'albums' | 'playlists', id: string) {
  const mk = getMusicKit()
  await mk.api.music(`/v1/me/library`, { [`ids[${type}]`]: id }, {
    fetchOptions: { method: 'POST' },
  })
}

// ——— Playback ———
// Using startPlaying: true lets MusicKit kick off playback atomically within
// setQueue, avoiding the race that produced "play() request was interrupted
// by pause()".
//
// We also retry once on transient failures (Widevine CDM sometimes isn't
// ready on the very first play attempt of a session — giving it a beat and
// re-calling play() usually succeeds). All user-visible errors go through
// the toast so silent failures don't happen anymore.

import { toast } from '../store/toast'

function extractPlaybackError(err: any): string {
  const candidates = [
    err?.errorCode,
    err?.code,
    err?.message,
    err?.name,
    err?.error?.errorCode,
    err?.error?.code,
    err?.error?.message,
    err?.detail?.errorCode,
    err?.detail?.code,
    err?.detail?.message,
  ]
  const found = candidates.find((v) => typeof v === 'string' && v.trim().length > 0)
  if (found) return found
  try {
    const json = JSON.stringify(err)
    if (json && json !== '{}') return json
  } catch {}
  return String(err ?? 'UNKNOWN_ERROR')
}

function isBenignPlayInterruption(raw: string): boolean {
  return /play\(\) request was interrupted/i.test(raw)
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fisher–Yates. Defined locally so this file doesn't have to static-import
 * player.ts (which would make the existing dynamic-import circle harder
 * to reason about).
 */
function fisherYates<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Re-apply the user's repeat preference after a setQueue (MusicKit JS
 * resets it on some builds).
 *
 * NOTE: shuffle is deliberately NOT re-applied here. We manage shuffle
 * entirely client-side (reordering the queue passed to setQueue and
 * using upNextIds / playedIds in the store), and leave MusicKit's
 * internal shuffleMode at 0 permanently. Re-enabling it on MusicKit
 * right before `play()` is what caused "click song → random song plays"
 * (MusicKit re-rolls the first item in the queue after setQueue).
 */
async function reapplyPlaybackModes() {
  try {
    const mk = getMusicKit()
    const MK = (window as any).MusicKit
    const { usePlayer } = await import('../store/player')
    const { repeat } = usePlayer.getState()
    const rMode = MK?.PlayerRepeatMode
    if (repeat === 'none') mk.repeatMode = rMode?.none ?? 0
    else if (repeat === 'one') mk.repeatMode = rMode?.one ?? 1
    else mk.repeatMode = rMode?.all ?? 2
    // Belt-and-braces: keep shuffleMode off after every setQueue.
    mk.shuffleMode = 0
  } catch {}
}

/** Seed the client-side upNext/played stacks from a freshly set queue. */
async function seedClientQueue(upNextIds: string[]) {
  try {
    const { usePlayer } = await import('../store/player')
    usePlayer.getState().seedQueue(upNextIds)
  } catch {}
}

/** Read the current store's shuffle flag (dynamic import to dodge cycles). */
async function readShuffleFlag(): Promise<boolean> {
  try {
    const { usePlayer } = await import('../store/player')
    return !!usePlayer.getState().shuffle
  } catch {
    return false
  }
}

type ApiProbe = {
  path: string
  status: number
  ok: boolean
  code?: string
  title?: string
  detail?: string
}

async function probeMusicApi(path: string): Promise<ApiProbe | null> {
  const mk = getMusicKit()
  if (!devToken || !mk.musicUserToken) return null

  try {
    const res = await fetch(`https://api.music.apple.com${path}`, {
      headers: {
        Authorization: `Bearer ${devToken}`,
        'Music-User-Token': String(mk.musicUserToken),
      },
    })
    const text = await res.text()
    let code: string | undefined
    let title: string | undefined
    let detail: string | undefined
    try {
      const json = JSON.parse(text)
      const e = Array.isArray(json?.errors) ? json.errors[0] : undefined
      code = typeof e?.code === 'string' ? e.code : undefined
      title = typeof e?.title === 'string' ? e.title : undefined
      detail = typeof e?.detail === 'string' ? e.detail : undefined
    } catch {}

    return {
      path,
      status: res.status,
      ok: res.ok,
      code,
      title,
      detail,
    }
  } catch {
    return null
  }
}

async function probeMediaLicenseContext() {
  const checks = await Promise.all([
    probeMusicApi('/v1/me/subscriptions'),
    probeMusicApi('/v1/me/storefront'),
    probeMusicApi('/v1/me/library/songs?limit=1'),
  ])
  const result = checks.filter(Boolean) as ApiProbe[]
  if (result.length > 0) {
    console.warn('[playback] media-license probe', result)
  }
  return result
}

function mediaLicenseHintFromProbe(probes: ApiProbe[]): string | null {
  const sub = probes.find((p) => p.path.includes('/v1/me/subscriptions'))
  const lib = probes.find((p) => p.path.includes('/v1/me/library/songs'))

  if (sub && (sub.status === 401 || sub.status === 403)) {
    return 'Apple Music subscription check failed (401/403). Your account may be signed in but not allowed to stream. Sign out + sign back in, then verify Apple Music subscription in the official app.'
  }
  if (sub && sub.status === 200 && !sub.ok) {
    return 'Apple Music subscription response is not OK. Verify your subscription and payment status in the official Apple Music app.'
  }
  if (lib && (lib.status === 401 || lib.status === 403)) {
    return 'Your Music User Token is not accepted for library access (401/403). Re-authorize Apple Music in the app (Sign out, then Sign in).' 
  }
  if (sub && sub.status === 200 && lib && lib.ok) {
    return 'Account checks passed, but DRM license still failed. This points to a local Widevine/Electron license-session issue on this machine.'
  }
  return null
}

async function detailedPlaybackMessage(raw: string): Promise<string> {
  if (/MEDIA_LICENSE/i.test(raw)) {
    const probes = await probeMediaLicenseContext().catch(() => [])
    const hint = mediaLicenseHintFromProbe(probes)
    if (hint) return hint
  }
  return friendlyPlaybackError(raw)
}

async function tryMediaLicenseRecovery(): Promise<boolean> {
  const now = Date.now()
  // Avoid recovery loops on repeated mediaPlaybackError events.
  if (now - lastMediaLicenseRecoveryAt < 45_000) return false
  lastMediaLicenseRecoveryAt = now

  try {
    const mk = getMusicKit()
    console.warn('[playback] attempting MEDIA_LICENSE recovery (refresh auth + lower bitrate)')
    if (typeof mk.authorize === 'function') {
      await mk.authorize()
    }
    try {
      const bitrate = window.MusicKit?.PlaybackBitrate
      if (bitrate?.STANDARD != null) mk.bitrate = bitrate.STANDARD
      else if (bitrate?.LOW != null) mk.bitrate = bitrate.LOW
      else mk.bitrate = 128
    } catch {}
    await wait(800)
    return true
  } catch (err) {
    console.warn('[playback] MEDIA_LICENSE recovery failed', err)
    return false
  }
}

async function runPlaybackAction(opts: {
  label: string
  primary: () => Promise<unknown>
  fallback?: () => Promise<unknown>
}) {
  try {
    await opts.primary()
    return
  } catch (err: any) {
    const first = extractPlaybackError(err)
    if (isBenignPlayInterruption(first)) return

    console.warn(`[playback] ${opts.label} failed, retrying…`, err)
    try {
      await wait(900)
      await opts.primary()
      return
    } catch (retryErr: any) {
      const second = extractPlaybackError(retryErr)
      if (isBenignPlayInterruption(second)) return

      if (/MEDIA_LICENSE|UNKNOWN_ERROR/i.test(second)) {
        const recovered = await tryMediaLicenseRecovery()
        if (recovered) {
          try {
            await opts.primary()
            return
          } catch (afterRecoveryErr: any) {
            console.warn('[playback] still failing after recovery', afterRecoveryErr)
          }
        }
      }

      if (opts.fallback) {
        try {
          console.warn(`[playback] ${opts.label} retry failed, using fallback…`, retryErr)
          await opts.fallback()
          return
        } catch (fallbackErr: any) {
          const finalRaw = extractPlaybackError(fallbackErr)
          console.error(`[playback] ${opts.label} fallback failed`, fallbackErr)
          toast.error('Playback failed', await detailedPlaybackMessage(finalRaw))
          return
        }
      }

      console.error(`[playback] ${opts.label} failed twice`, retryErr)
      toast.error('Playback failed', await detailedPlaybackMessage(second))
    }
  }
}

export function friendlyPlaybackError(raw: string): string {
  if (/CONTENT_EQUIVALENT/i.test(raw)) {
    return "Storefront mismatch. The track exists in one region but your Apple Music subscription is in another. Remove APPLE_STOREFRONT from .env (or set it to your subscription country) and restart."
  }
  if (/MEDIA_LICENSE/i.test(raw)) {
    return "Widevine DRM couldn't get a license. Wait 30-60s (CDM may be downloading) or sign out & sign back in."
  }
  if (/widevine|CDM|EME/i.test(raw)) return 'Widevine DRM is still warming up — try again in a few seconds.'
  if (/subscription|unauthorized|401|403/i.test(raw)) return 'Your Apple Music session expired. Sign out + back in.'
  if (/not found|404/i.test(raw)) return "This track isn't available in your storefront."
  if (/network|timeout|fetch/i.test(raw)) return 'Network hiccup. Check your connection.'
  if (/UNKNOWN_ERROR/i.test(raw)) {
    return 'MusicKit returned a generic playback failure. This is usually a DRM startup issue in Electron. Wait 15-30 seconds and try again; if it persists, sign out and sign back in.'
  }
  return raw.slice(0, 180)
}

export async function playSongs(songIds: string[], startAt = 0) {
  const ids = songIds
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
  if (ids.length === 0) return
  const index = Math.max(0, Math.min(startAt, ids.length - 1))
  const ordered = index > 0 ? [...ids.slice(index), ...ids.slice(0, index)] : ids
  // Library song IDs often look like "i.<...>" and can cause setQueue({ songs })
  // to fail with UNKNOWN_ERROR in MusicKit JS. Keep catalog song IDs only.
  const playable = ordered.filter((id) => !/^i\./i.test(id))
  if (playable.length === 0) {
    toast.error(
      'Playback failed',
      'This list only contains library-only tracks that MusicKit JS cannot queue directly. Try a catalog track from Search.',
    )
    return
  }
  if (playable.length !== ordered.length) {
    console.warn(`[playSongs] dropped ${ordered.length - playable.length} library-only IDs`)
  }
  const mk = getMusicKit()

  // Single-song playback seeds a **radio-style queue** rooted on that
  // track. Two API shapes worth trying:
  //
  //   { station: `ra.<songId>` }  —  Apple's personal song-radio. This
  //     uses Apple's collaborative-filtering + content-based similarity
  //     for the seed track, THEN incorporates the user's taste profile.
  //     Far more coherent than "related songs by title/name".
  //
  //   { song: <songId> }          —  queue one song and let autoplay
  //     extend. Simpler but Apple's "related" relation sometimes
  //     clusters by track TITLE (we saw one Turkish folk track produce
  //     a queue of 20 unrelated songs literally named "Gizli Gizli").
  //
  // We try station first, fall back to `song:` only if the station
  // can't be created (e.g. very new/unindexed catalog song).
  if (playable.length === 1) {
    const songId = playable[0]
    await runPlaybackAction({
      label: 'playSongs (single → station)',
      primary: async () => {
        await mk.setQueue({ station: `ra.${songId}` })
        await reapplyPlaybackModes()
        await wait(300)
        await mk.play()
      },
      fallback: async () => {
        try {
          await mk.setQueue({ song: songId })
          await reapplyPlaybackModes()
          await wait(200)
          await mk.play()
          return
        } catch {}
        // Last resort: plain single-element queue + Apple autoplay.
        await mk.setQueue({ songs: playable, startPlaying: true })
        await reapplyPlaybackModes()
      },
    })
    // Station queues are opaque — we can't project them into upNext/played,
    // so reset those so the user doesn't see stale data.
    await seedClientQueue([])
    return
  }

  // Shuffle pre-mix: the clicked song stays at index 0 (so MusicKit plays
  // IT first, not a random track), but everything after it is Fisher–Yates
  // shuffled so auto-advance also respects shuffle mode. This replaces
  // MusicKit's own shuffleMode behaviour, which re-rolled the first item.
  const shuffleOn = await readShuffleFlag()
  const finalQueue = shuffleOn && playable.length > 1
    ? [playable[0], ...fisherYates(playable.slice(1))]
    : playable

  await runPlaybackAction({
    label: 'playSongs',
    primary: async () => {
      await mk.setQueue({ songs: finalQueue })
      await reapplyPlaybackModes()
      // Give Widevine CDM time to process the license before playing.
      // The atomic startPlaying: true can race with license installation
      // in Electron's Widevine implementation.
      await wait(300)
      await mk.play()
    },
    fallback: async () => {
      await mk.setQueue({ songs: finalQueue, startPlaying: true })
      await reapplyPlaybackModes()
    },
  })
  // Seed the client queue AFTER setQueue so event-handler advanceToTrack
  // sees the right upNext when the first nowPlayingItemDidChange fires.
  await seedClientQueue(finalQueue.slice(1))
}

export async function playAlbum(albumId: string, startAt = 0) {
  // Shuffle case: resolve track IDs up front and delegate to playSongs so
  // the pre-mix + client queue seeding lands exactly like a track click.
  if (await readShuffleFlag()) {
    try {
      const album = await getAlbum(albumId)
      const trackIds: string[] = (album?.relationships?.tracks?.data ?? [])
        .map((t: any) => String(t?.id ?? ''))
        .filter(Boolean)
      if (trackIds.length > 0) {
        await playSongs(trackIds, startAt)
        return
      }
    } catch (err) {
      console.warn('[playAlbum] failed to resolve track IDs for shuffle, falling back', err)
    }
  }

  const mk = getMusicKit()
  const index = Math.max(0, startAt)
  await runPlaybackAction({
    label: 'playAlbum',
    primary: async () => {
      await mk.setQueue({ album: albumId })
      await reapplyPlaybackModes()
      if (index > 0 && typeof mk.changeToMediaAtIndex === 'function') {
        await mk.changeToMediaAtIndex(index)
      }
      await wait(300)
      await mk.play()
    },
    fallback: async () => {
      await mk.setQueue({ album: albumId, startWith: index, startPlaying: true })
      await reapplyPlaybackModes()
    },
  })
  await seedUpNextFromMusicKit()
}

export async function playPlaylist(playlistId: string, startAt = 0) {
  if (await readShuffleFlag()) {
    try {
      const playlist = await getPlaylist(playlistId)
      const trackIds: string[] = (playlist?.relationships?.tracks?.data ?? [])
        .map((t: any) => String(t?.attributes?.playParams?.catalogId ?? t?.id ?? ''))
        .filter(Boolean)
      if (trackIds.length > 0) {
        await playSongs(trackIds, startAt)
        return
      }
    } catch (err) {
      console.warn('[playPlaylist] failed to resolve track IDs for shuffle, falling back', err)
    }
  }

  const mk = getMusicKit()
  const index = Math.max(0, startAt)
  await runPlaybackAction({
    label: 'playPlaylist',
    primary: async () => {
      await mk.setQueue({ playlist: playlistId })
      await reapplyPlaybackModes()
      if (index > 0 && typeof mk.changeToMediaAtIndex === 'function') {
        await mk.changeToMediaAtIndex(index)
      }
      await wait(300)
      await mk.play()
    },
    fallback: async () => {
      await mk.setQueue({ playlist: playlistId, startWith: index, startPlaying: true })
      await reapplyPlaybackModes()
    },
  })
  await seedUpNextFromMusicKit()
}

/**
 * After a setQueue that was built from an album/playlist alias (so we
 * didn't pass an explicit songs[] array), pull the resolved queue IDs
 * back out of MusicKit and seed the client upNext. The first item is
 * "now playing" — the upcoming queue is everything after it.
 */
async function seedUpNextFromMusicKit() {
  try {
    const mk = getMusicKit()
    const items = Array.isArray(mk.queue?.items) ? mk.queue.items : []
    const currentIdx = mk.nowPlayingItemIndex ?? 0
    const ids = items
      .map((it: any) => String(it?.id ?? ''))
      .filter((id: string) => !!id && !/^i\./i.test(id))
    await seedClientQueue(ids.slice(currentIdx + 1))
  } catch {}
}

/** Insert a catalog song right after the currently playing track. Uses
 * MusicKit's playNext so the queue isn't rebuilt and playback doesn't blip. */
export async function queuePlayNext(songId: string): Promise<void> {
  if (!songId || /^i\./i.test(songId)) return
  const mk = getMusicKit()
  try {
    if (typeof mk.playNext === 'function') {
      await mk.playNext({ song: songId })
    } else if (mk.queue?.prepend) {
      await mk.queue.prepend({ song: songId })
    }
    // Mirror to client upNext so shuffle-aware navigation stays coherent.
    try {
      const { usePlayer } = await import('../store/player')
      const cur = usePlayer.getState().upNextIds
      usePlayer.setState({ upNextIds: [songId, ...cur.filter((id) => id !== songId)] })
    } catch {}
  } catch (err) {
    console.warn('[queue] playNext failed', err)
  }
}

/** Append a catalog song to the end of the current queue. */
export async function queuePlayLater(songId: string): Promise<void> {
  if (!songId || /^i\./i.test(songId)) return
  const mk = getMusicKit()
  try {
    if (typeof mk.playLater === 'function') {
      await mk.playLater({ song: songId })
    } else if (mk.queue?.append) {
      await mk.queue.append({ song: songId })
    }
    try {
      const { usePlayer } = await import('../store/player')
      const cur = usePlayer.getState().upNextIds
      usePlayer.setState({ upNextIds: [...cur.filter((id) => id !== songId), songId] })
    } catch {}
  } catch (err) {
    console.warn('[queue] playLater failed', err)
  }
}

/**
 * Drop a specific index from the queue WITHOUT restarting the current
 * track. Preference order:
 *
 *   1. `mk.queue.remove(idx)` — present on most MusicKit JS v3 builds.
 *      Mutates the internal queue in place, no playback touch.
 *   2. `_queueItems.splice()` — undocumented backing-array fallback
 *      for builds where `.remove` isn't exposed.
 *   3. Full rebuild via `setQueue` — last resort. Pauses, rebuilds,
 *      waits for the new track to report non-zero duration, seeks to
 *      the old playback position, resumes. Even with the seek, this
 *      path has user-visible stutter (license re-negotiation on some
 *      CDN builds), which is why we only fall into it if the queue
 *      refuses in-place mutation.
 */
export async function queueRemoveAt(removeIdx: number): Promise<void> {
  const mk = getMusicKit()
  const items = Array.isArray(mk.queue?.items) ? mk.queue.items : []
  if (removeIdx < 0 || removeIdx >= items.length) return
  const currentIdx = mk.nowPlayingItemIndex ?? 0
  const removedId = String(items[removeIdx]?.id ?? '')

  // Mirror the removal in the client upNext/played stacks regardless of
  // which MusicKit path succeeds — they're just strings, worst case we
  // filter an ID that wasn't there.
  try {
    const { usePlayer } = await import('../store/player')
    const { upNextIds, playedIds } = usePlayer.getState()
    usePlayer.setState({
      upNextIds: upNextIds.filter((id) => id !== removedId),
      playedIds: playedIds.filter((id) => id !== removedId),
    })
  } catch {}

  if (removeIdx === currentIdx) {
    await mk.skipToNextItem().catch(() => {})
    return
  }

  // 1. Official mutation method on MusicKit JS v3 queues.
  if (mk.queue && typeof mk.queue.remove === 'function') {
    try {
      mk.queue.remove(removeIdx)
      return
    } catch (err) {
      console.warn('[queueRemoveAt] queue.remove() threw, falling back', err)
    }
  }

  // 2. Internal backing array splice. MusicKit v3 typically keeps the
  //    array at `_queueItems`; guard against API drift by looping over
  //    every plausible property.
  const backingCandidates: string[] = [
    '_queueItems',
    '_items',
    'items',
    '_unshuffledItems',
  ]
  for (const prop of backingCandidates) {
    const internal = (mk.queue as any)?.[prop]
    if (Array.isArray(internal) && typeof internal.splice === 'function' && internal.length === items.length) {
      try {
        internal.splice(removeIdx, 1)
        return
      } catch (err) {
        console.warn(`[queueRemoveAt] splice on ${prop} failed`, err)
      }
    }
  }

  // 3. Last resort: rebuild the queue. This is the path that can still
  //    cause a short audio blip, but it's only reached when MusicKit
  //    exposes no in-place mutation at all.
  const currentId = String(items[currentIdx]?.id ?? '')
  const songs = items
    .map((it: any, i: number) => (i === removeIdx ? null : String(it?.id ?? '')))
    .filter((id: string | null) => !!id && !/^i\./i.test(id as string)) as string[]
  if (!songs.includes(currentId)) {
    console.warn('[queueRemoveAt] current track would be dropped, skipping')
    return
  }
  const newCurrent = songs.indexOf(currentId)
  const currentTimeSec = mk.currentPlaybackTime ?? 0
  const wasPlaying = mk.isPlaying
  try { await mk.pause() } catch {}
  await mk.setQueue({ songs, startWith: newCurrent })
  await reapplyPlaybackModes()
  for (let i = 0; i < 20; i++) {
    if ((mk.currentPlaybackDuration ?? 0) > 0) break
    await wait(60)
  }
  try { await mk.seekToTime(currentTimeSec) } catch {}
  if (wasPlaying) await mk.play().catch(() => {})
}

/** Reorder queue: move `fromIdx` to `toIdx`. Rebuilds the queue since
 * MusicKit's queue.items is effectively read-only. The currently playing
 * track keeps playing at the new index, preserving position. */
export async function queueMove(fromIdx: number, toIdx: number): Promise<void> {
  if (fromIdx === toIdx) return
  const mk = getMusicKit()
  const items = Array.isArray(mk.queue?.items) ? mk.queue.items : []
  if (fromIdx < 0 || fromIdx >= items.length || toIdx < 0 || toIdx >= items.length) return
  const songs = items
    .map((it: any) => String(it?.id ?? ''))
    .filter((id: string) => !!id && !/^i\./i.test(id)) as string[]
  if (fromIdx >= songs.length || toIdx >= songs.length) return
  const [moved] = songs.splice(fromIdx, 1)
  songs.splice(toIdx, 0, moved)
  const currentIdx = mk.nowPlayingItemIndex ?? 0
  // Figure out where the currently-playing track now lives in the new order.
  let newCurrent = currentIdx
  if (fromIdx === currentIdx) newCurrent = toIdx
  else {
    if (fromIdx < currentIdx) newCurrent--
    if (toIdx <= currentIdx) newCurrent++
  }
  newCurrent = Math.max(0, Math.min(songs.length - 1, newCurrent))
  const currentTimeMs = Math.round((mk.currentPlaybackTime ?? 0) * 1000)
  const wasPlaying = mk.isPlaying
  await mk.setQueue({ songs, startWith: newCurrent })
  await reapplyPlaybackModes()
  // Resume at the same playback time so reorder feels seamless.
  try { await mk.seekToTime(currentTimeMs / 1000) } catch {}
  if (wasPlaying) await mk.play().catch(() => {})
}

export async function playStation(stationId: string) {
  const mk = getMusicKit()
  await runPlaybackAction({
    label: 'playStation',
    primary: async () => {
      await mk.setQueue({ station: stationId })
      await reapplyPlaybackModes()
      await wait(300)
      await mk.play()
    },
    fallback: async () => {
      await mk.setQueue({ station: stationId, startPlaying: true })
      await reapplyPlaybackModes()
    },
  })
  // Stations are opaque on the MusicKit side — they stream one track at a
  // time and we can't project the upcoming list. Clear our client queue so
  // the Queue drawer + shuffle logic don't show stale history.
  await seedClientQueue([])
}

// ——— Create library playlist ———

export async function createLibraryPlaylist(name: string, description?: string, songIds: string[] = []) {
  const mk = getMusicKit()
  const body: any = {
    attributes: { name, description: description || '' },
  }
  if (songIds.length > 0) {
    body.relationships = {
      tracks: {
        data: songIds.map((id) => ({ id, type: 'songs' })),
      },
    }
  }
  const res = await mk.api.music('/v1/me/library/playlists', undefined, {
    fetchOptions: {
      method: 'POST',
      body: JSON.stringify(body),
    },
  })
  return res.data?.data?.[0]
}

export async function addToLibraryPlaylist(playlistId: string, songIds: string[]) {
  if (songIds.length === 0) return
  const mk = getMusicKit()
  await mk.api.music(`/v1/me/library/playlists/${playlistId}/tracks`, undefined, {
    fetchOptions: {
      method: 'POST',
      body: JSON.stringify({
        data: songIds.map((id) => ({ id, type: 'songs' })),
      }),
    },
  })
}

// Copy catalog URL for a given track/album/playlist
export async function catalogUrl(item: any): Promise<string | null> {
  try {
    const sf = await storefront()
    const type = String(item.type ?? '').replace('library-', '')
    const id = item.attributes?.playParams?.catalogId || item.id
    if (!type || !id) return null
    return `https://music.apple.com/${sf}/${type.replace(/s$/, '')}/${id}`
  } catch {
    return null
  }
}