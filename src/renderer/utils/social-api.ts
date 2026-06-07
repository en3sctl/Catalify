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
  // Keep socialDeviceKey so the user can log back into the same handle.
}
