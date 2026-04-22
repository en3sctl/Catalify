import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { GripVertical, ListMusic, X } from 'lucide-react'
import { getMusicKit, queueMove, queueRemoveAt } from '../utils/musickit-api'
import { artworkUrl } from '../utils/format'
import { usePlayer } from '../store/player'

interface QueueItemModel {
  id: string
  key: string
  title: string
  artist: string
  artwork: string
}

/**
 * Live view of MusicKit's queue with drag-to-reorder and per-row remove.
 * We mirror the queue into local state so the optimistic drop lands before
 * MusicKit finishes its rebuild (otherwise the item would snap back).
 */
export function QueueDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<QueueItemModel[]>([])
  const [dragging, setDragging] = useState(false)
  const itemsRef = useRef<QueueItemModel[]>([])
  const dragSnapshotRef = useRef<QueueItemModel[] | null>(null)
  const nowPlayingId = usePlayer((s) => s.nowPlaying?.id)
  const location = useLocation()
  // Immersive Now Playing view hides the bottom transport bar, so the
  // drawer should extend all the way down instead of reserving space for
  // a non-existent bar (that's the "cut off at the bottom" bug).
  const immersive = location.pathname === '/now-playing'

  // Keep a ref in sync so drag-end handlers (which close over stale state)
  // can read the latest order without re-subscribing.
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (!open) return
    const refresh = () => {
      // Never clobber local state while the user is actively dragging.
      if (dragging) return
      try {
        const mk = getMusicKit()
        const raw = mk.queue?.items ?? []
        const mapped: QueueItemModel[] = raw.map((it: any, idx: number) => {
          const attrs = it?.attributes ?? {}
          return {
            id: String(it?.id ?? idx),
            key: `${it?.id ?? idx}-${idx}`,
            title: attrs.name ?? 'Unknown',
            artist: attrs.artistName ?? '',
            artwork: artworkUrl(attrs.artwork?.url, 120),
          }
        })
        setItems(mapped)
      } catch {
        setItems([])
      }
    }
    refresh()
    const id = setInterval(refresh, 1500)
    return () => clearInterval(id)
  }, [open, dragging])

  const handleDragStart = () => {
    dragSnapshotRef.current = itemsRef.current
    setDragging(true)
  }

  const handleDragEnd = (draggedKey: string) => {
    setDragging(false)
    const snapshot = dragSnapshotRef.current
    dragSnapshotRef.current = null
    if (!snapshot) return
    const fromIdx = snapshot.findIndex((x) => x.key === draggedKey)
    const toIdx = itemsRef.current.findIndex((x) => x.key === draggedKey)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
    queueMove(fromIdx, toIdx).catch((err) => console.warn('queueMove failed', err))
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-[var(--titlebar-h)] w-[380px] z-50 glass border-l border-white/[0.06] flex flex-col"
            style={{ bottom: immersive ? 0 : 'var(--nowplaying-h)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <ListMusic size={16} className="accent-text" />
                <h3 className="text-sm font-semibold tracking-tight">Up next</h3>
                {items.length > 0 && (
                  <span className="text-[11px] text-obsidian-400 ml-1">{items.length}</span>
                )}
              </div>
              <button onClick={onClose} className="text-obsidian-300 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
              {items.length === 0 && (
                <div className="text-obsidian-400 text-sm italic px-4 py-8 text-center">
                  Queue is empty.
                </div>
              )}
              {items.length > 0 && (
                <Reorder.Group
                  axis="y"
                  values={items}
                  onReorder={setItems}
                  className="flex flex-col"
                >
                  {items.map((item, i) => (
                    <QueueRow
                      key={item.key}
                      item={item}
                      index={i}
                      isNow={item.id === nowPlayingId}
                      onDragStart={handleDragStart}
                      onDragEnd={() => handleDragEnd(item.key)}
                      onRemove={() => {
                        setItems((cur) => cur.filter((_, idx) => idx !== i))
                        queueRemoveAt(i).catch((err) => console.warn('queueRemoveAt failed', err))
                      }}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function QueueRow({
  item,
  index,
  isNow,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  item: QueueItemModel
  index: number
  isNow: boolean
  onRemove: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, zIndex: 50, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.6)' }}
      className={`group flex items-center gap-2 px-2 mx-1 py-2 rounded-lg select-none ${
        isNow ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'
      }`}
      onDoubleClick={() => {
        try {
          getMusicKit().changeToMediaAtIndex?.(index)
        } catch {}
      }}
    >
      <div
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing text-obsidian-400 hover:text-white/80 touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </div>
      <img
        src={item.artwork}
        className="w-10 h-10 rounded bg-obsidian-800 object-cover flex-shrink-0"
        alt=""
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] ${isNow ? 'accent-text font-semibold' : 'text-white'}`}>
          {item.title}
        </div>
        <div className="truncate text-[11px] text-obsidian-300">{item.artist}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="opacity-0 group-hover:opacity-100 text-obsidian-400 hover:text-red-400 transition p-1"
        title="Remove"
      >
        <X size={14} />
      </button>
    </Reorder.Item>
  )
}
