import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ListMusic } from 'lucide-react'
import { createLibraryPlaylist } from '../utils/musickit-api'
import { toast } from '../store/toast'

export function CreatePlaylistDialog({
  open,
  onClose,
  onCreated,
  seedSongIds = [],
}: {
  open: boolean
  onClose: () => void
  onCreated?: (playlist: any) => void
  seedSongIds?: string[]
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 100) } }, [open])

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const pl = await createLibraryPlaylist(name.trim(), description.trim() || undefined, seedSongIds)
      toast.success('Playlist created', `"${name.trim()}" is in your library.`)
      onCreated?.(pl)
      setName('')
      setDescription('')
      onClose()
    } catch (err: any) {
      toast.error('Failed to create playlist', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[70]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[440px] max-w-[92vw] liquid-glass-strong p-6 rounded-3xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl accent-bg text-dusk flex items-center justify-center">
                  <ListMusic size={18} />
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-cream">New playlist</h3>
                  <p className="text-[11px] text-cream/60">Syncs to your Apple Music library</p>
                </div>
              </div>
              <button onClick={onClose} className="text-cream/60 hover:text-cream p-1"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Name</label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                  placeholder="e.g. Late nights"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[14px] text-cream placeholder:text-cream/30 focus:border-white/[0.18] outline-none selectable"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="what's the vibe?"
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-cream placeholder:text-cream/30 focus:border-white/[0.18] outline-none resize-none selectable"
                />
              </div>
            </div>

            {seedSongIds.length > 0 && (
              <div className="mt-3 text-[12px] text-cream/70">
                Will add {seedSongIds.length} {seedSongIds.length === 1 ? 'song' : 'songs'} on create.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[13px] text-cream/80 hover:text-cream hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!name.trim() || busy}
                className="px-5 py-2 rounded-xl accent-bg text-dusk text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 transition"
              >
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
