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
    // MusicKit's `authorize()` internally calls `unauthorize()` first to wipe
    // any prior session. On a fresh Electron install there's no login cookie,
    // so Apple's `webPlayerLogout` / `unauthenticate` endpoints return 403,
    // which the library propagates as AUTHORIZATION_ERROR — killing the whole
    // login flow before the popup even opens. Replace the internal method
    // with a no-op so the cleanup step can't fail; a real logout is triggered
    // separately via our own `unauthorize()` helper when the user clicks
    // Sign Out, and at that point the session cookie exists so it succeeds.
    const originalUnauthorize = instance.unauthorize?.bind(instance)
    ;(instance as any).__realUnauthorize = originalUnauthorize
    instance.unauthorize = async () => {
      // no-op during authorize()-driven cleanup; real sign-out goes through
      // `unauthorize()` in this module which calls `__realUnauthorize`.
    }
    // Prefer standard bitrate first; some Electron/Widevine setups fail license
    // negotiation at higher variants and recover only after a manual downgrade.
    try { instance.bitrate = window.MusicKit.PlaybackBitrate?.STANDARD ?? 128 } catch {}
    // Autoplay ON. After a single-song play ends, Apple streams related
    // tracks (same as the Apple Music web player's Up Next auto-generated
    // list). Multi-track lists still route through our client engine
    // first — our `playbackStateDidChange` state=5/10 handler calls
    // `usePlayer.next()` as long as `playbackQueue.length > 1`, so
    // autoplay only kicks in when our queue is genuinely exhausted.
    //
    // NOTE: Apple's "related" algorithm can occasionally cluster by track
    // title on obscure catalogue items (we saw this with "Gizli Gizli" —
    // a Turkish folk title shared by many unrelated songs). That's an
    // Apple-side data quality issue, not something we can fix here.
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
  // Call the real MusicKit unauthorize stashed in configureMusicKit.
  // We swapped `mk.unauthorize` with a no-op so that authorize() can't
  // self-destruct on fresh installs (see that comment for the full story).
  const real = (mk as any).__realUnauthorize
  if (typeof real === 'function') {
    try { await real() } catch (err) { console.warn('[unauthorize] real call failed', err) }
  }
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

/**
 * Apple Music catalog charts — top songs / albums / playlists for the
 * user's storefront. Apple updates these throughout the day, so it's the
 * cheapest way to give Home some "today vs yesterday" variety without
 * needing the listening-history APIs (which require pro tokens).
 *
 * The `/charts` endpoint itself does NOT return relationships, which
 * means TrackRow / MediaCard can't link artist or album names from the
 * raw response. We re-hydrate songs + albums via `/v1/catalog/.../songs`
 * and `/v1/catalog/.../albums` with `include=artists,albums` so the
 * resulting items carry `relationships.artists.data[0].id` etc — which
 * is what the link-resolution fallback chain in TrackRow / MediaCard
 * looks for first.
 *
 * Returns `{ songs, albums, playlists }` where each is an array of items.
 */
export async function getCharts(
  types: Array<'songs' | 'albums' | 'playlists'> = ['songs', 'albums', 'playlists'],
  limit = 20,
) {
  const mk = getMusicKit()
  const sf = await storefront()
  try {
    const res = await mk.api.music(`/v1/catalog/${sf}/charts`, {
      types: types.join(','),
      limit,
    })
    const groups = res.data?.results ?? {}
    const pick = (key: string) => groups[key]?.[0]?.data ?? []
    let songs = pick('songs') as any[]
    let albums = pick('albums') as any[]
    const playlists = pick('playlists') as any[]

    // Enrich songs with artist/album relationships in a single batch call.
    if (songs.length > 0) {
      try {
        const ids = songs.map((s) => s.id).filter(Boolean)
        const detail = await mk.api.music(`/v1/catalog/${sf}/songs`, {
          ids: ids.join(','),
          include: 'artists,albums',
        })
        const map = new Map<string, any>()
        for (const s of detail.data?.data ?? []) map.set(s.id, s)
        songs = songs.map((s) => map.get(s.id) ?? s)
      } catch (err) {
        console.warn('[charts] song enrichment failed', err)
      }
    }

    // Same trick for albums so MediaCard's "artist subtitle as link" works.
    if (albums.length > 0) {
      try {
        const ids = albums.map((a) => a.id).filter(Boolean)
        const detail = await mk.api.music(`/v1/catalog/${sf}/albums`, {
          ids: ids.join(','),
          include: 'artists',
        })
        const map = new Map<string, any>()
        for (const a of detail.data?.data ?? []) map.set(a.id, a)
        albums = albums.map((a) => map.get(a.id) ?? a)
      } catch (err) {
        console.warn('[charts] album enrichment failed', err)
      }
    }

    return { songs, albums, playlists }
  } catch (err: any) {
    console.warn('[MusicKit] /v1/catalog/charts unavailable', err?.message || err)
    return { songs: [], albums: [], playlists: [] }
  }
}

/**
 * Editorial groupings Apple curates per storefront — "New Music",
 * "Today's Hits", genre showcases. The exact slugs vary by region so we
 * accept whatever is returned. Useful as a "Browse" rail.
 */
export async function getEditorialGroupings(limit = 12) {
  const mk = getMusicKit()
  const sf = await storefront()
  try {
    const res = await mk.api.music(`/v1/editorial/${sf}/groupings`, { limit })
    return (res.data?.data as any[]) ?? []
  } catch (err: any) {
    console.warn('[MusicKit] /v1/editorial/groupings unavailable', err?.message || err)
    return []
  }
}

/**
 * Tries `/v1/me/recommendations` again with a `groupId` filter to get
 * fresher/different cards than the default landing rail. Apple rotates
 * groupIds throughout the day so the result drifts naturally.
 */
export async function getRotatingRecommendations(limit = 12) {
  const mk = getMusicKit()
  try {
    // Cache-bust by appending a coarse hour-bucket — Apple's response
    // varies modestly across hours, but more importantly this skips any
    // local HTTP cache MusicKit might have layered in.
    const bucket = Math.floor(Date.now() / (1000 * 60 * 30)).toString()
    const res = await mk.api.music('/v1/me/recommendations', {
      limit,
      // Pass the bucket as a benign param — Apple ignores unknown query
      // keys but the URL changes, defeating any in-memory cache.
      _t: bucket,
    } as any)
    return res.data?.data ?? []
  } catch (err: any) {
    console.warn('[MusicKit] rotating recommendations unavailable', err?.message || err)
    return []
  }
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
 * Re-apply the user's repeat preference after a setQueue (MusicKit JS
 * resets it on some builds). Shuffle stays off on MusicKit permanently
 * — the client owns sequencing via `playbackQueue`.
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
    mk.shuffleMode = 0
  } catch {}
}

/**
 * Seed the client-side queue engine from a freshly set MusicKit queue.
 * `originalPlaylist` is the immutable source order; `startId` is the
 * track MusicKit is about to play (becomes `playbackQueue[0]`).
 */
async function seedClientQueue(
  originalPlaylist: string[],
  startId: string,
  artistMap?: Record<string, string>,
) {
  try {
    const { usePlayer } = await import('../store/player')
    usePlayer.getState().seedQueue(originalPlaylist, startId, artistMap)
  } catch {}
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

/**
 * `playSongs` is the single entry point for "user clicked play on an
 * ordered list of tracks". It always hands MusicKit exactly ONE song
 * via `setQueue({ song })`, and seeds the client-side queue engine
 * (`usePlayer.originalPlaylist` + `playbackQueue`) which is the sole
 * source of truth for "what plays next". `artistMap` is optional; when
 * provided (album/playlist), `smartShuffle` uses it to spread clusters.
 */
export async function playSongs(
  songIds: string[],
  startAt = 0,
  artistMap?: Record<string, string>,
) {
  const ids = songIds
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
  if (ids.length === 0) return
  const index = Math.max(0, Math.min(startAt, ids.length - 1))
  // Library song IDs often look like "i.<...>" and can cause setQueue
  // to fail with UNKNOWN_ERROR in MusicKit JS. Keep catalog IDs only,
  // but preserve the original order so `originalPlaylist` is coherent.
  const playableOriginal = ids.filter((id) => !/^i\./i.test(id))
  if (playableOriginal.length === 0) {
    toast.error(
      'Playback failed',
      'This list only contains library-only tracks that MusicKit JS cannot queue directly. Try a catalog track from Search.',
    )
    return
  }
  if (playableOriginal.length !== ids.length) {
    console.warn(`[playSongs] dropped ${ids.length - playableOriginal.length} library-only IDs`)
  }
  // Resolve the clicked track against the filtered pool so "start at
  // index 3" still picks the right track after library-only entries
  // were dropped.
  const clickedRaw = ids[index]
  const clickedId = playableOriginal.includes(clickedRaw)
    ? clickedRaw
    : playableOriginal[0]

  const mk = getMusicKit()
  await runPlaybackAction({
    label: 'playSongs',
    primary: async () => {
      await mk.setQueue({ song: clickedId })
      await reapplyPlaybackModes()
      await wait(300)
      await mk.play()
    },
    fallback: async () => {
      await mk.setQueue({ song: clickedId, startPlaying: true })
      await reapplyPlaybackModes()
    },
  })
  await seedClientQueue(playableOriginal, clickedId, artistMap)
}

/**
 * Album playback resolves to catalog track IDs and delegates to
 * `playSongs`. We also pass artistName info so smart shuffle can
 * spread featuring artists out from the main album artist.
 */
export async function playAlbum(albumId: string, startAt = 0) {
  try {
    const album = await getAlbum(albumId)
    const tracks = album?.relationships?.tracks?.data ?? []
    const trackIds: string[] = tracks
      .map((t: any) => String(t?.id ?? ''))
      .filter(Boolean)
    const artistMap: Record<string, string> = {}
    for (const t of tracks) {
      const tid = String(t?.id ?? '')
      const name = t?.attributes?.artistName
      if (tid && typeof name === 'string') artistMap[tid] = name
    }
    if (trackIds.length > 0) {
      await playSongs(trackIds, startAt, artistMap)
    }
  } catch (err) {
    console.error('[playAlbum] failed to resolve track IDs', err)
    toast.error('Playback failed', 'Could not load this album right now.')
  }
}

export async function playPlaylist(playlistId: string, startAt = 0) {
  try {
    const playlist = await getPlaylist(playlistId)
    const tracks = playlist?.relationships?.tracks?.data ?? []
    const trackIds: string[] = tracks
      .map((t: any) => String(t?.attributes?.playParams?.catalogId ?? t?.id ?? ''))
      .filter(Boolean)
    const artistMap: Record<string, string> = {}
    for (const t of tracks) {
      const tid = String(t?.attributes?.playParams?.catalogId ?? t?.id ?? '')
      const name = t?.attributes?.artistName
      if (tid && typeof name === 'string') artistMap[tid] = name
    }
    if (trackIds.length > 0) {
      await playSongs(trackIds, startAt, artistMap)
    }
  } catch (err) {
    console.error('[playPlaylist] failed to resolve track IDs', err)
    toast.error('Playback failed', 'Could not load this playlist right now.')
  }
}

/**
 * Client-side queue mutations. MusicKit's own queue is always a
 * single-song playback unit, so "add to queue" / "remove from queue"
 * / "reorder" reduce to mutating `usePlayer.playbackQueue`. Manual
 * inserts are flagged `priority: true` so they survive shuffle toggles.
 */
export async function queuePlayNext(songId: string): Promise<void> {
  if (!songId || /^i\./i.test(songId)) return
  try {
    const { usePlayer } = await import('../store/player')
    const cur = usePlayer.getState().playbackQueue
    // Splice at index 1 — right after the current track. Dedupe against
    // existing entries (excluding current) so re-adding doesn't stack.
    const head = cur[0]
    const tail = cur.slice(1).filter((it) => it.id !== songId)
    const nextQueue = head
      ? [head, { id: songId, priority: true }, ...tail]
      : [{ id: songId, priority: true }]
    usePlayer.setState({ playbackQueue: nextQueue })
  } catch (err) {
    console.warn('[queuePlayNext] failed', err)
  }
}

export async function queuePlayLater(songId: string): Promise<void> {
  if (!songId || /^i\./i.test(songId)) return
  try {
    const { usePlayer } = await import('../store/player')
    const cur = usePlayer.getState().playbackQueue
    const head = cur[0]
    const tail = cur.slice(1).filter((it) => it.id !== songId)
    const nextQueue = head
      ? [head, ...tail, { id: songId, priority: true }]
      : [{ id: songId, priority: true }]
    usePlayer.setState({ playbackQueue: nextQueue })
  } catch (err) {
    console.warn('[queuePlayLater] failed', err)
  }
}

/**
 * Remove a track from the upcoming queue (indices ≥ 1). The currently
 * playing track can't be removed this way — use `next()` instead.
 */
export async function queueRemoveById(songId: string): Promise<void> {
  if (!songId) return
  try {
    const { usePlayer } = await import('../store/player')
    const { playbackQueue, playedIds } = usePlayer.getState()
    const head = playbackQueue[0]
    if (head?.id === songId) return // never drop the active track
    usePlayer.setState({
      playbackQueue: playbackQueue.filter((it, i) => i === 0 || it.id !== songId),
      playedIds: playedIds.filter((id) => id !== songId),
    })
  } catch (err) {
    console.warn('[queueRemoveById] failed', err)
  }
}

export async function queueRemoveAt(removeIdx: number): Promise<void> {
  try {
    const { usePlayer } = await import('../store/player')
    const q = usePlayer.getState().playbackQueue
    // Queue drawer indexes start at 0 for the upcoming list, which
    // maps to playbackQueue[removeIdx + 1].
    const item = q[removeIdx + 1]
    if (item) await queueRemoveById(item.id)
  } catch {}
}

/**
 * Reorder within the upcoming queue (indices ≥ 1). `from` / `to` are
 * indices INTO playbackQueue. Index 0 (current track) is fixed — the
 * caller should already be passing indices ≥ 1, but we guard anyway.
 */
export async function queueMove(fromIdx: number, toIdx: number): Promise<void> {
  if (fromIdx === toIdx) return
  try {
    const { usePlayer } = await import('../store/player')
    const q = [...usePlayer.getState().playbackQueue]
    if (fromIdx < 1 || fromIdx >= q.length || toIdx < 1 || toIdx >= q.length) return
    const [moved] = q.splice(fromIdx, 1)
    q.splice(toIdx, 0, moved)
    usePlayer.setState({ playbackQueue: q })
  } catch (err) {
    console.warn('[queueMove] failed', err)
  }
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
  // Stations stream one track at a time — no projectable source pool.
  // Clear the client queue so the drawer + shuffle logic don't show
  // stale data from a prior session.
  try {
    const { usePlayer } = await import('../store/player')
    usePlayer.setState({
      originalPlaylist: [],
      playbackQueue: [],
      playedIds: [],
      sourceArtists: {},
    })
  } catch {}
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