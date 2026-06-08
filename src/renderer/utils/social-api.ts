/**
 * Client for catalify-api (Çatalify's social backend Worker + D1).
 *
 * Auth model: username + device key. On first use we generate a long random
 * device secret and persist it locally (electron-store). The server keeps
 * only its SHA-256; the session token is a 30-day JWT. Everything is stored
 * via the existing `window.bombo.store` IPC — no new preload bridge needed.
 *
 * Phase 1 endpoints only (identity). Phase 2+ (follow, playlists) extend this.
 */

import { shrinkDataUrl } from './image'

const BASE = 'https://catalify-api.flair1-flair.workers.dev'

export interface SocialUser {
  id: number
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  createdAt: number
}

export const HANDLE_RE = /^[a-z0-9_]{2,20}$/

// ── local persistence (electron-store via window.bombo.store) ──

async function getDeviceKey(): Promise<string> {
  let k = await window.bombo.store.get<string>('socialDeviceKey')
  if (!k || k.length < 16) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    k = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    await window.bombo.store.set('socialDeviceKey', k)
  }
  return k
}

export async function getToken(): Promise<string | null> {
  return (await window.bombo.store.get<string>('socialToken')) || null
}

export async function getStoredUser(): Promise<SocialUser | null> {
  return (await window.bombo.store.get<SocialUser>('socialUser')) || null
}

async function setSession(token: string, user: SocialUser) {
  await window.bombo.store.set('socialToken', token)
  await window.bombo.store.set('socialUser', user)
}

// ── HTTP ──

interface ApiError extends Error {
  status?: number
  code?: string
}

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  const token = await getToken()
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: ApiError = new Error(data?.error || res.statusText)
    err.status = res.status
    err.code = data?.error
    throw err
  }
  return data
}

// ── public API ──

export async function handleAvailable(handle: string): Promise<boolean> {
  if (!HANDLE_RE.test(handle)) return false
  try {
    const d = await api(`/handle-available?handle=${encodeURIComponent(handle)}`)
    return !!d.available
  } catch {
    return false
  }
}

export async function registerAccount(handle: string, displayName: string): Promise<SocialUser> {
  const deviceKey = await getDeviceKey()
  const d = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ handle, displayName, deviceKey }),
  })
  await setSession(d.token, d.user)
  return d.user
}

export async function loginAccount(handle: string): Promise<SocialUser> {
  const deviceKey = await getDeviceKey()
  const d = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ handle, deviceKey }),
  })
  await setSession(d.token, d.user)
  return d.user
}

export async function fetchMe(): Promise<SocialUser | null> {
  try {
    const d = await api('/me')
    await window.bombo.store.set('socialUser', d.user)
    return d.user
  } catch {
    return null
  }
}

export async function updateProfile(patch: {
  displayName?: string
  bio?: string
  avatarUrl?: string
}): Promise<SocialUser> {
  const d = await api('/me', { method: 'PATCH', body: JSON.stringify(patch) })
  await window.bombo.store.set('socialUser', d.user)
  return d.user
}

export async function signOutSocial(): Promise<void> {
  await window.bombo.store.delete('socialToken')
  await window.bombo.store.delete('socialUser')
  await window.bombo.store.delete('socialAvatarSource')
  // Keep socialDeviceKey so the user can log back into the same handle.
}

/**
 * Push the user's local profile avatar (downscaled to a tiny JPEG) to the
 * social backend so friends see their picture. Only re-syncs when the local
 * avatar actually changed (tracked via `socialAvatarSource`).
 */
export async function syncAvatar(): Promise<SocialUser | null> {
  try {
    const local = await window.bombo.store.get<string>('profileAvatar')
    if (!local) return null
    const lastSrc = await window.bombo.store.get<string>('socialAvatarSource')
    if (local === lastSrc) return null
    const small = await shrinkDataUrl(local, 96)
    const u = await updateProfile({ avatarUrl: small })
    await window.bombo.store.set('socialAvatarSource', local)
    return u
  } catch {
    return null
  }
}

// ── Phase 2: social graph ──

export interface FriendUser extends SocialUser {
  isFollowing?: boolean
  followers?: number
  following?: number
  isMe?: boolean
}

export async function searchUsers(q: string): Promise<FriendUser[]> {
  if (!q.trim()) return []
  try {
    const d = await api(`/users/search?q=${encodeURIComponent(q.trim())}`)
    return d.users ?? []
  } catch {
    return []
  }
}

export async function getUserByHandle(handle: string): Promise<FriendUser | null> {
  try {
    const d = await api(`/users/${encodeURIComponent(handle)}`)
    return d.user ?? null
  } catch {
    return null
  }
}

export async function followUser(id: number): Promise<void> {
  await api(`/users/${id}/follow`, { method: 'POST' })
}

export async function unfollowUser(id: number): Promise<void> {
  await api(`/users/${id}/follow`, { method: 'DELETE' })
}

export async function getFollowing(): Promise<FriendUser[]> {
  try {
    const d = await api('/me/following')
    return d.users ?? []
  } catch {
    return []
  }
}

export async function getFollowers(): Promise<FriendUser[]> {
  try {
    const d = await api('/me/followers')
    return d.users ?? []
  } catch {
    return []
  }
}

// ── Phase 3: playlist sharing ──

export interface SharedPlaylist {
  applePlaylistId: string
  title: string
  artUrl: string | null
  trackIds: string[]
  sharedAt: number
}

export async function sharePlaylist(input: {
  applePlaylistId: string
  title: string
  artUrl?: string | null
  trackIds: string[]
}): Promise<void> {
  await api('/me/playlists/share', { method: 'POST', body: JSON.stringify(input) })
}

export async function unsharePlaylist(applePlaylistId: string): Promise<void> {
  await api('/me/playlists/share', { method: 'DELETE', body: JSON.stringify({ applePlaylistId }) })
}

export async function getMySharedPlaylists(): Promise<SharedPlaylist[]> {
  try {
    const d = await api('/me/playlists/shared')
    return d.playlists ?? []
  } catch {
    return []
  }
}

export async function getUserPlaylists(userId: number): Promise<SharedPlaylist[]> {
  try {
    const d = await api(`/users/${userId}/playlists`)
    return d.playlists ?? []
  } catch {
    return []
  }
}

// ── Phase 4: presence (now playing) ──

export interface FriendPresence {
  id: number
  handle: string
  displayName: string
  avatarUrl: string | null
  trackId: string | null
  title: string
  artist: string
  artUrl: string | null
  isPlaying: boolean
  updatedAt: number
}

export interface FollowNotification {
  type: 'follow'
  at: number
  user: { id: number; handle: string; displayName: string; avatarUrl: string | null }
}

export async function getNotifications(): Promise<FollowNotification[]> {
  try {
    const d = await api('/me/notifications')
    return d.notifications ?? []
  } catch {
    return []
  }
}

export async function putPresence(input: {
  trackId?: string | null
  title: string
  artist: string
  artUrl?: string | null
  isPlaying: boolean
}): Promise<void> {
  try {
    await api('/me/presence', { method: 'PUT', body: JSON.stringify(input) })
  } catch {
    // presence is best-effort
  }
}

export async function getFollowingPresence(): Promise<FriendPresence[]> {
  try {
    const d = await api('/feed/presence')
    return d.presence ?? []
  } catch {
    return []
  }
}
