import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Moon } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useT } from '../i18n'

export function SleepTimer() {
  const sleepAt = usePlayer((s) => s.sleepTimerMs)
  const setSleepTimer = usePlayer((s) => s.setSleepTimer)
  const t = useT()
  const [open, setOpen] = useState(false)
  const [remaining, setRemaining] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!sleepAt) { setRemaining(''); return }
    const tick = () => {
      const ms = sleepAt - Date.now()
      if (ms <= 0) { setRemaining(''); return }
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sleepAt])

  const toggle = () => {
    if (!open && btnRef.current) setAnchor(btnRef.current.getBoundingClientRect())
    setOpen((v) => !v)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className={`relative p-2 rounded-lg hover:bg-white/[0.06] transition ${sleepAt ? 'accent-text' : 'text-obsidian-300'}`}
        title={t('sleepTimer')}
      >
        <Moon size={16} />
        {remaining && (
          <span className="absolute -top-1 -right-1 text-[9px] font-mono bg-obsidian-950 border border-white/[0.06] rounded-full px-1.5 py-0.5 accent-text">
            {remaining}
          </span>
        )}
      </button>
      {/* Portaled to <body>: inside the blurred NowPlayingBar the glass
          backdrop-filter can't sample anything (ancestor backdrop root),
          which made the menu look transparent/buggy. As a top-level
          sibling it samples the real backdrop — same as the QueueDrawer. */}
      {open && anchor &&
        createPortal(
          <div
            className="fixed glass rounded-xl p-2 w-[200px] shadow-deep z-50"
            style={{
              // Explicit width + left (not right/shrink-wrap): a fixed
              // element with only `right` set stretched across the window.
              left: Math.max(8, anchor.right - 200),
              bottom: window.innerHeight - anchor.top + 8,
            }}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-widest text-obsidian-300">{t('stopPlaybackIn')}</div>
            {[5, 10, 15, 30, 45, 60, 90].map((m) => (
              <button
                key={m}
                onClick={() => { setSleepTimer(m); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 rounded text-[13px] hover:bg-white/[0.05]"
              >
                {t('minutesShort').replace('{n}', String(m))}
              </button>
            ))}
            {sleepAt && (
              <>
                <div className="border-t border-white/[0.06] my-1"></div>
                <button
                  onClick={() => { setSleepTimer(null); setOpen(false) }}
                  className="w-full text-left px-3 py-1.5 rounded text-[13px] text-red-300 hover:bg-white/[0.05]"
                >
                  {t('cancelTimer')}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
