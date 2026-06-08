import { create } from 'zustand'
import { FollowNotification, getNotifications } from '../utils/social-api'

/**
 * Single poller for social notifications (currently new followers). Both the
 * top-right toast cards and the sidebar bell read from here, so we hit the
 * API once. `unseen` is computed against a persisted "last opened the bell"
 * timestamp; the cards track their own session baseline separately.
 */
interface NotifState {
  items: FollowNotification[]
  unseen: number
  ready: boolean
  start: () => void
  stop: () => void
  refresh: () => Promise<void>
  markSeen: () => void
}

let pollId: number | null = null

export const useNotifications = create<NotifState>((set, get) => ({
  items: [],
  unseen: 0,
  ready: false,
  refresh: async () => {
    const items = await getNotifications()
    const lastSeen = (await window.bombo.store.get<number>('socialLastNotifSeen')) ?? 0
    set({ items, unseen: items.filter((n) => n.at > lastSeen).length, ready: true })
  },
  start: () => {
    if (pollId) return
    get().refresh()
    pollId = window.setInterval(() => get().refresh(), 30000)
  },
  stop: () => {
    if (pollId) {
      window.clearInterval(pollId)
      pollId = null
    }
    set({ items: [], unseen: 0, ready: false })
  },
  markSeen: () => {
    const newest = get().items[0]?.at ?? Math.floor(Date.now() / 1000)
    window.bombo.store.set('socialLastNotifSeen', newest)
    set({ unseen: 0 })
  },
}))
