import { create } from 'zustand'
import {
  SocialUser,
  fetchMe,
  getStoredUser,
  getToken,
  registerAccount,
  signOutSocial,
  updateProfile,
} from '../utils/social-api'

interface SocialState {
  /** The signed-in Çatalify social account, or null if not set up. */
  user: SocialUser | null
  /** False until the first load from electron-store completes. */
  ready: boolean
  init: () => Promise<void>
  register: (handle: string, displayName: string) => Promise<void>
  update: (patch: { displayName?: string; bio?: string; avatarUrl?: string }) => Promise<void>
  signOut: () => Promise<void>
}

export const useSocial = create<SocialState>((set) => ({
  user: null,
  ready: false,
  init: async () => {
    // Show the cached account instantly, then refresh from the server so
    // profile edits made on another device (later, with recovery) reflect.
    const stored = await getStoredUser()
    set({ user: stored, ready: true })
    if (await getToken()) {
      const fresh = await fetchMe()
      if (fresh) set({ user: fresh })
    }
  },
  register: async (handle, displayName) => {
    const u = await registerAccount(handle, displayName)
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
