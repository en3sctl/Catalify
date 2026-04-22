import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { clsx } from '../utils/format'

export type ContextMenuItem =
  | { type: 'separator' }
  | {
      type?: 'item'
      label: string
      icon?: LucideIcon
      shortcut?: string
      danger?: boolean
      disabled?: boolean
      onClick: () => void
    }

interface Ctx {
  open: (event: React.MouseEvent | MouseEvent, items: ContextMenuItem[]) => void
  close: () => void
}

const ContextMenuCtx = createContext<Ctx | null>(null)

export function useContextMenu() {
  const ctx = useContext(ContextMenuCtx)
  if (!ctx) throw new Error('useContextMenu must be used inside <ContextMenuProvider>')
  return ctx
}

/**
 * Single, global right-click menu for the app. Renders through a portal so
 * it always floats above other stacking contexts. Each consumer calls
 * `useContextMenu().open(event, items)` from an `onContextMenu` handler.
 */
export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

  const open: Ctx['open'] = useCallback((event, items) => {
    event.preventDefault?.()
    setState({ x: event.clientX, y: event.clientY, items })
  }, [])
  const close = useCallback(() => setState(null), [])

  return (
    <ContextMenuCtx.Provider value={{ open, close }}>
      {children}
      <AnimatePresence>
        {state && (
          <MenuPortal
            x={state.x}
            y={state.y}
            items={state.items}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </ContextMenuCtx.Provider>
  )
}

function MenuPortal({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [adjusted, setAdjusted] = useState({ x, y })

  // Flip to the other side of the cursor if we'd overflow the viewport.
  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const nx = x + rect.width > vw - 8 ? Math.max(8, x - rect.width) : x
    const ny = y + rect.height > vh - 8 ? Math.max(8, y - rect.height) : y
    if (nx !== adjusted.x || ny !== adjusted.y) setAdjusted({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[1000]"
      onClick={onClose}
      onContextMenu={(e) => {
        // Right-click outside the menu closes it; also let the user open
        // a NEW menu somewhere else on the same click without firing twice.
        e.preventDefault()
        onClose()
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.08 }}
    >
      <motion.div
        ref={ref}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.11, ease: [0.16, 1, 0.3, 1] }}
        className="absolute min-w-[220px] max-w-[320px] rounded-xl p-1 bg-[rgba(16,12,24,0.92)] backdrop-blur-2xl border border-white/[0.07] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] text-[13px]"
        style={{ left: adjusted.x, top: adjusted.y }}
      >
        {items.map((item, i) => {
          if (item.type === 'separator') {
            return <div key={i} className="my-1 mx-2 h-px bg-white/[0.06]" />
          }
          const Icon = item.icon
          return (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return
                item.onClick()
                onClose()
              }}
              className={clsx(
                'w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-left transition',
                item.disabled && 'opacity-40 cursor-not-allowed',
                !item.disabled && !item.danger && 'text-obsidian-100 hover:bg-white/[0.07] hover:text-white',
                !item.disabled && item.danger && 'text-red-400 hover:bg-red-500/15 hover:text-red-300',
              )}
            >
              {Icon ? (
                <Icon size={14} className="flex-shrink-0" />
              ) : (
                <span className="w-[14px]" />
              )}
              <span className="flex-1 truncate">{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-obsidian-400 font-mono tracking-tight">
                  {item.shortcut}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
