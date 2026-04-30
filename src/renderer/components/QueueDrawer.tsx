import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { GripVertical, ListMusic, Pin, X } from 'lucide-react'
import { getCatalogSongsByIds, getMusicKit } from '../utils/musickit-api'
import { artworkUrl } from '../utils/format'
import { usePlayer, QueueItem } from '../store/player'

interface QueueItemModel {
  id: string
  key: string
  title: string
  artist: string
  artwork: string
  priority: boolean
}

/**
 * Up-next drawer. Reads directly from the client queue engine
 * (`usePlayer.playbackQueue`) — index 0 is the currently playing
 * track (pinned, not reorderable), [1..] is the upcoming list the
 * user can drag / remove / skip to.
 */
export function QueueDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const playbackQueue = usePlayer((s) => s.playbackQueue)
  const nowPlayingId = usePlayer((s) => s.nowPlaying?.id)
  const [songMeta, setSongMeta] = useState<Record<string, any>>({})
  const [dragging, setDragging] = useState(false)
  const [optimisticUpcoming, setOptimisticUpcoming] = useState<QueueItem[] | null>(null)
  const dragSnapshotRef = useRef<QueueItem[] | null>(null)
  const location = useLocation()
  const immersive = location.pathname === '/now-playing'

  const allIds = playbackQueue.map((it) => it.id)

  useEffect(() => {
    if (!open) return
    const missing = allIds.filter((id) => !songMeta[id] && !/^i\./i.test(id))
    if (missing.length === 0) return
    let cancelled = false
    getCatalogSongsByIds(missing)
      .then((songs) => {
        if (cancelled) return
        const add: Record<string, any> = {}
        for (const s of songs) add[s.id] = s
        setSongMeta((prev) => ({ ...prev, ...add }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, allIds.join('|'), songMeta])

  const currentItem = playbackQueue[0]
  const upcoming = optimisticUpcoming ?? playbackQueue.slice(1)

  const toModel = (it: QueueItem, idx: number): QueueItemModel => {
    const s = songMeta[it.id]
    const attrs = s?.attributes ?? {}
    return {
      id: it.id,
      key: `${it.id}-${idx}`,
      title: attrs.name ?? 'Loading…',
      artist: attrs.artistName ?? '',
      artwork: artworkUrl(attrs.artwork?.url, 120) ?? '',
      priority: !!it.priority,
    }
  }

  const upcomingModels: QueueItemModel[] = upcoming.map(toModel)
  const currentModel = currentItem ? toModel(currentItem, 0) : null

  const handleReorder = (next: QueueItemModel[]) => {
    const idToItem = new Map(upcoming.map((it) => [it.id, it]))
    setOptimisticUpcoming(
      next.map((m) => idToItem.get(m.id) ?? { id: m.id, priority: m.priority }),
    )
  }

  const handleDragStart = () => {
    dragSnapshotRef.current = upcoming
    setDragging(true)
  }

  const handleDragEnd = () => {
    setDragging(false)
    const committed = optimisticUpcoming
    setOptimisticUpcoming(null)
    if (committed && currentItem) {
      usePlayer.setState({ playbackQueue: [currentItem, ...committed] })
    }
    dragSnapshotRef.current = null
  }

  const handleRemove = (id: string) => {
    const { playbackQueue: q, playedIds } = usePlayer.getState()
    // Never remove the active head — UI disables the ✕ on it anyway.
    usePlayer.setState({
      playbackQueue: q.filter((it, i) => i === 0 || it.id !== id),
      playedIds: playedIds.filter((pid) => pid !== id),
    })
  }

  const handleJumpTo = async (songId: string) => {
    try {
      const state = usePlayer.getState()
      const { playbackQueue: q, playedIds } = state
      const idx = q.findIndex((it) => it.id === songId)
      if (idx > 0) {
        // Everything between head and target is considered "listened" for
        // the purposes of the previous-stack — same semantics as hitting
        // next() repeatedly.
        const consumed = q.slice(0, idx).map((it) => it.id)
        usePlayer.setState({
          playbackQueue: q.slice(idx),
          playedIds: [...playedIds, ...consumed],
        })
      }
      const mk = getMusicKit()
      await mk.setQueue({ song: songId })
      await mk.play()
    } catch (err) {
      console.warn('[QueueDrawer] jump failed', err)
    }
  }

  useEffect(() => {
    if (!dragging) setOptimisticUpcoming(null)
  }, [playbackQueue, dragging])

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
                <h3 className="text-sm font-semibold tracking-tight">Sıradakiler</h3>
                {upcomingModels.length > 0 && (
                  <span className="text-[11px] text-obsidian-400 ml-1">{upcomingModels.length}</span>
                )}
              </div>
              <button onClick={onClose} className="text-obsidian-300 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
              {currentModel && (
                <>
                  <div className="px-3 pb-1 pt-1">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-obsidian-400">
                      Şimdi çalıyor
                    </div>
                  </div>
                  <CurrentRow item={currentModel} isNow={currentModel.id === nowPlayingId} />
                  {upcomingModels.length > 0 && (
                    <div className="mx-3 mt-3 mb-1 flex items-center gap-2">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-[10px] uppercase tracking-[0.14em] text-obsidian-400">
                        Kuyruk
                      </span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                  )}
                </>
              )}
              {!currentModel && upcomingModels.length === 0 && (
                <div className="text-obsidian-400 text-sm italic px-4 py-8 text-center">
                  Queue is empty.
                </div>
              )}
              {upcomingModels.length > 0 && (
                <Reorder.Group
                  axis="y"
                  values={upcomingModels}
                  onReorder={handleReorder}
                  className="flex flex-col"
                >
                  {upcomingModels.map((item) => (
                    <QueueRow
                      key={item.key}
                      item={item}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onRemove={() => handleRemove(item.id)}
                      onJumpTo={() => handleJumpTo(item.id)}
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

function CurrentRow({ item, isNow }: { item: QueueItemModel; isNow: boolean }) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 mx-1 py-2 rounded-lg ${
        isNow ? 'bg-white/[0.06]' : 'bg-white/[0.035]'
      }`}
    >
      <div className="w-[14px]" />
      <img
        src={item.artwork}
        className="w-10 h-10 rounded bg-obsidian-800 object-cover flex-shrink-0"
        alt=""
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] accent-text font-semibold">{item.title}</div>
        <div className="truncate text-[11px] text-obsidian-300">{item.artist}</div>
      </div>
    </div>
  )
}

function QueueRow({
  item,
  onRemove,
  onDragStart,
  onDragEnd,
  onJumpTo,
}: {
  item: QueueItemModel
  onRemove: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onJumpTo: () => void
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
      className="group flex items-center gap-2 px-2 mx-1 py-2 rounded-lg select-none hover:bg-white/[0.035]"
      onDoubleClick={onJumpTo}
    >
      <div
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing text-obsidian-400 hover:text-white/80 touch-none"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </div>
      <div className="relative flex-shrink-0">
        <img
          src={item.artwork}
          className="w-10 h-10 rounded bg-obsidian-800 object-cover"
          alt=""
          draggable={false}
        />
        {item.priority && (
          <div
            className="absolute -top-1 -right-1 bg-accent-500/95 text-white rounded-full p-[3px] shadow"
            title="Kuyruğa elle eklendi"
          >
            <Pin size={9} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-white">{item.title}</div>
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
