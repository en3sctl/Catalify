import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, Sparkles, X } from 'lucide-react'

/**
 * Discord-style "update ready" card. When electron-updater finishes
 * downloading a new release in the background, this slides in at the top-
 * right with a single button that installs + relaunches immediately
 * (`updater.installNow()` → main `quitAndInstall(false, true)`), instead of
 * making the user manually close and reopen the app.
 *
 * Self-contained: attaches the IPC listener itself. In `npm run dev` the
 * main-process updater short-circuits, so the event never fires and this
 * renders nothing.
 */
export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as any).bombo?.updater
    if (!api) return
    const off = api.onUpdateDownloaded(({ version }: { version: string | null }) => {
      setVersion(version ?? '')
      setDismissed(false)
    })
    return () => off?.()
  }, [])

  const show = version !== null && !dismissed

  const install = () => {
    setInstalling(true)
    try {
      ;(window as any).bombo?.updater?.installNow()
    } catch {
      setInstalling(false)
    }
  }

  return (
    <div
      className="fixed right-4 z-[60] pointer-events-none"
      style={{ top: 'calc(var(--titlebar-h) + 12px)' }}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="pointer-events-auto liquid-glass rounded-2xl p-4 w-[320px] shadow-deep relative overflow-hidden"
          >
            {/* Soft accent glow in the corner */}
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-25 blur-2xl pointer-events-none"
              style={{ background: 'rgb(var(--accent))' }}
            />
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-2.5 right-2.5 text-obsidian-400 hover:text-cream transition"
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3 relative">
              <div className="w-9 h-9 rounded-xl accent-bg text-obsidian-950 flex items-center justify-center flex-shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="text-[13.5px] font-semibold text-cream">Update ready</div>
                <div className="text-[12px] text-obsidian-300 mt-0.5 leading-snug">
                  {version ? `Çatalify ${version} is ready.` : 'A new version is ready.'} Restart now
                  to update — takes a couple seconds.
                </div>
              </div>
            </div>
            <button
              onClick={install}
              disabled={installing}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-bg text-obsidian-950 font-semibold text-[13px] hover:brightness-110 disabled:opacity-70 transition"
            >
              <RefreshCw size={14} className={installing ? 'animate-spin' : ''} />
              {installing ? 'Restarting…' : 'Restart & update'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
