import { useEffect, useState } from 'react'

/**
 * Local custom playlist covers. The Apple Music public API does NOT let us
 * set custom artwork on a library playlist, so a user-picked cover photo is
 * persisted locally (electron-store, keyed by the library playlist id) and
 * layered on top of Apple's artwork wherever a playlist is rendered.
 *
 * A tiny in-memory cache + listener set lets the React hook read covers
 * synchronously after first load and re-render every consumer when one
 * changes, without each call site hitting the IPC store again.
 */
const STORE_KEY = 'localPlaylistCovers'

let cache: Record<string, string> | null = null
let loading: Promise<Record<string, string>> | null = null
const listeners = new Set<() => void>()

function load(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache)
  if (!loading) {
    loading = window.bombo.store
      .get<Record<string, string>>(STORE_KEY)
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

/** Synchronous read once the cache is warm (undefined until first load). */
export function peekPlaylistCover(id?: string | null): string | undefined {
  if (!id || !cache) return undefined
  return cache[id]
}

export async function setPlaylistCover(id: string, dataUrl: string): Promise<void> {
  const map = await load()
  const next = { ...map, [id]: dataUrl }
  cache = next
  await window.bombo.store.set(STORE_KEY, next)
  notify()
}

export async function removePlaylistCover(id: string): Promise<void> {
  const map = await load()
  if (!(id in map)) return
  const next = { ...map }
  delete next[id]
  cache = next
  await window.bombo.store.set(STORE_KEY, next)
  notify()
}

/**
 * React hook: returns the local cover data URL for a playlist id, or
 * undefined if none is set. Re-renders when that playlist's cover changes.
 */
export function useLocalPlaylistCover(id?: string | null): string | undefined {
  const [cover, setCover] = useState<string | undefined>(() => peekPlaylistCover(id))
  useEffect(() => {
    let alive = true
    const sync = () => {
      if (alive) setCover(peekPlaylistCover(id))
    }
    load().then(sync)
    listeners.add(sync)
    return () => {
      alive = false
      listeners.delete(sync)
    }
  }, [id])
  return cover
}
