import { useEffect, useState } from 'react'

/**
 * Local playlist metadata overrides (name + description). Apple's public
 * API can't rename a library playlist or edit its description, so — exactly
 * like the custom cover — the user's edits are persisted locally
 * (electron-store, keyed by the library playlist id) and layered on top of
 * Apple's values wherever the playlist is rendered. Çatalify-local only;
 * it does not sync back to the Apple Music app.
 */
const STORE_KEY = 'localPlaylistMeta'

export interface PlaylistMeta {
  name?: string
  description?: string
}

let cache: Record<string, PlaylistMeta> | null = null
let loading: Promise<Record<string, PlaylistMeta>> | null = null
const listeners = new Set<() => void>()

function load(): Promise<Record<string, PlaylistMeta>> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = window.bombo.store
      .get<Record<string, PlaylistMeta>>(STORE_KEY)
      .then((v) => {
        cache = v && typeof v === 'object' ? v : {}
        return cache
      })
      .catch(() => {
        cache = {}
        return cache
      })
  }
  return loading
}

function notify() {
  listeners.forEach((l) => l())
}

export function peekPlaylistMeta(id?: string | null): PlaylistMeta | undefined {
  if (!id || !cache) return undefined
  return cache[id]
}

export async function setPlaylistMeta(id: string, meta: PlaylistMeta): Promise<void> {
  const map = await load()
  // Drop empty fields so we don't shadow Apple's value with "".
  const cleaned: PlaylistMeta = {}
  if (meta.name && meta.name.trim()) cleaned.name = meta.name.trim()
  if (meta.description && meta.description.trim()) cleaned.description = meta.description.trim()
  const next = { ...map }
  if (Object.keys(cleaned).length === 0) delete next[id]
  else next[id] = cleaned
  cache = next
  await window.bombo.store.set(STORE_KEY, next)
  notify()
}

/** React hook: local name/description overrides for a playlist id. */
export function useLocalPlaylistMeta(id?: string | null): PlaylistMeta | undefined {
  const [meta, setMeta] = useState<PlaylistMeta | undefined>(() => peekPlaylistMeta(id))
  useEffect(() => {
    let alive = true
    const sync = () => {
      if (alive) setMeta(peekPlaylistMeta(id))
    }
    load().then(sync)
    listeners.add(sync)
    return () => {
      alive = false
      listeners.delete(sync)
    }
  }, [id])
  return meta
}
