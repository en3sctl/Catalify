import { create } from 'zustand'
import {
  SocialUser,
  fetchMe,
  getStoredUser,
  getToken,
  loginAccount,
  registerAccount,
  signOutSocial,
  updateProfile,
} from '../utils/social-api'

interface SocialState {
  /** The signed-in Çatalify social account, or null if not set up. */
  user: SocialUser | null
  /** False until the first load from electron-store completes. */
  ready: boolean
  /** Opt-in: broadcast "now playing" to friends. Default on. */
  shareActivity: boolean
  init: () => Promise<void>
  register: (handle: string, displayName: string) => Promise<void>
  /** Log back into an existing handle using this device's stored key. */
  login: (handle: string) => Promise<void>
  update: (patch: { displayName?: string; bio?: string; avatarUrl?: string }) => Promise<void>
  setShareActivity: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useSocial = create<SocialState>((set) => ({
  user: null,
  ready: false,
  shareActivity: true,
  init: async () => {
    // Show the cached account instantly, then refresh from the server so
    // profile edits made on another device (later, with recovery) reflect.
    const stored = await getStoredUser()
    const share = await window.bombo.store.get<boolean>('socialShareActivity')
    set({ user: stored, ready: true, shareActivity: share !== false })
    if (await getToken()) {
      const fresh = await fetchMe()
      if (fresh) set({ user: fresh })
    }
  },
  setShareActivity: (v) => {
    set({ shareActivity: v })
    window.bombo.store.set('socialShareActivity', v)
  },
  register: async (handle, displayName) => {
    const u = await registerAccount(handle, displayName)
    set({ user: u })
  },
  login: async (handle) => {
    const u = await loginAccount(handle)
    set({ user: u })
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
