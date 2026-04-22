import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  message?: string
  durationMs: number
}

interface ToastState {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number }) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = nextId++
    const item: ToastItem = { id, durationMs: 4200, ...t }
    set({ items: [...get().items, item] })
    window.setTimeout(() => {
      set({ items: get().items.filter((x) => x.id !== id) })
    }, item.durationMs)
  },
  dismiss: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}))

// Convenience helpers
export const toast = {
  info: (title: string, message?: string) =>
    useToast.getState().push({ kind: 'info', title, message }),
  success: (title: string, message?: string) =>
    useToast.getState().push({ kind: 'success', title, message }),
  error: (title: string, message?: string) =>
    useToast.getState().push({ kind: 'error', title, message, durationMs: 6000 }),
}
