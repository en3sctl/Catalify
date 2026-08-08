import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Slim top-of-window banner while the network is down. Streaming, search
 * and social all fail confusingly offline — one honest line beats a wall
 * of cryptic toasts. Auto-dismisses the moment connectivity returns.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/15 border border-rose-400/25 backdrop-blur-xl text-rose-200 text-[12.5px] font-medium shadow-deep"
          style={{ top: 'calc(var(--titlebar-h) + 10px)' }}
        >
          <WifiOff size={13} />
          No internet — playback and search are paused until you're back online.
        </motion.div>
      )}
    </AnimatePresence>
  )
}
