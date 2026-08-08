import { create } from 'zustand'
import {
  FavoriteItem,
  SocialUser,
  fetchMe,
  getStoredUser,
  getToken,
  loginAccount,
  putTaste,
  registerAccount,
  signOutSocial,
  syncAvatar,
  updateProfile,
} from '../utils/social-api'

/**
 * Blend fuel: push the user's followed-artist ids to the backend as their
 * "taste". Waits for the player store's librarySaved.artists to populate
 * (it fills from Apple on Library load / syncLibraryArtists), and only
 * uploads when the set actually changed since the last sync.
 */
async function syncTasteWhenReady() {
  const { usePlayer } = await import('./player')
  const attempt = async (): Promise<boolean> => {
    const ids = Object.keys(usePlayer.getState().librarySaved.artists)
    if (ids.length === 0) return false
    const top = ids.slice(0, 120)
    const hash = top.slice().sort().join(',')
    const last = await window.bombo.store.get<string>('tasteSyncHash')
    if (hash !== last) {
      await putTaste(top)
      await window.bombo.store.set('tasteSyncHash', hash)
    }
    return true
  }
  try {
    if (await attempt()) return
  } catch {
    return // API down — try again next launch
  }
  // Artists not loaded yet — fire once when they appear.
  const unsub = usePlayer.subscribe((s) => {
    if (Object.keys(s.librarySaved.artists).length > 0) {
      unsub()
      attempt().catch(() => {})
    }
  })
}

interface SocialState {
  /** The signed-in Çatalify social account, or null if not set up. */
  user: SocialUser | null
  /** False until the first load from electron-store completes. */
  ready: boolean
  /** Opt-in: broadcast "now playing" to friends. Default on. */
  shareActivity: boolean
  /**
   * Active "listen along" session — mirror this friend's playback until
   * they stop or the user turns it off. Session-only, never persisted.
   */
  listenAlong: { userId: number; handle: string } | null
  setListenAlong: (v: { userId: number; handle: string } | null) => void
  init: () => Promise<void>
  register: (handle: string, displayName: string) => Promise<void>
  /** Log back into an existing handle using this device's stored key. */
  login: (handle: string) => Promise<void>
  update: (patch: {
    displayName?: string
    bio?: string
    avatarUrl?: string
    hideLists?: boolean
    favoriteArtist?: FavoriteItem | null
    favoriteSong?: FavoriteItem | null
  }) => Promise<void>
  setShareActivity: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useSocial = create<SocialState>((set) => ({
  user: null,
  ready: false,
  shareActivity: true,
  listenAlong: null,
  setListenAlong: (v) => set({ listenAlong: v }),
  init: async () => {
    // Show the cached account instantly, then refresh from the server so
    // profile edits made on another device (later, with recovery) reflect.
    const stored = await getStoredUser()
    const share = await window.bombo.store.get<boolean>('socialShareActivity')
    set({ user: stored, ready: true, shareActivity: share !== false })
    if (await getToken()) {
      const fresh = await fetchMe()
      if (fresh) set({ user: fresh })
      const synced = await syncAvatar()
      if (synced) set({ user: synced })
      if (fresh) syncTasteWhenReady().catch(() => {})
    }
  },
  setShareActivity: (v) => {
    set({ shareActivity: v })
    window.bombo.store.set('socialShareActivity', v)
  },
  register: async (handle, displayName) => {
    const u = await registerAccount(handle, displayName)
    set({ user: u })
    const synced = await syncAvatar()
    if (synced) set({ user: synced })
  },
  login: async (handle) => {
    const u = await loginAccount(handle)
    set({ user: u })
    const synced = await syncAvatar()
    if (synced) set({ user: synced })
  },
  update: async (patch) => {
    const u = await updateProfile(patch)
    set({ user: u })
  },
  signOut: async () => {
    await signOutSocial()
    set({ user: null })
  },
}))
