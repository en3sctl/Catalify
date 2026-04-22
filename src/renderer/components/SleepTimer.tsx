import { useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { usePlayer } from '../store/player'

export function SleepTimer() {
  const sleepAt = usePlayer((s) => s.sleepTimerMs)
  const setSleepTimer = usePlayer((s) => s.setSleepTimer)
  const [open, setOpen] = useState(false)
  const [remaining, setRemaining] = useState('')

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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-lg hover:bg-white/[0.06] transition ${sleepAt ? 'accent-text' : 'text-obsidian-300'}`}
        title="Sleep timer"
      >
        <Moon size={16} />
        {remaining && (
          <span className="absolute -top-1 -right-1 text-[9px] font-mono bg-obsidian-950 border border-white/[0.06] rounded-full px-1.5 py-0.5 accent-text">
            {remaining}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 glass rounded-xl p-2 min-w-[180px] shadow-deep z-50"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-widest text-obsidian-300">Stop playback in</div>
          {[5, 10, 15, 30, 45, 60, 90].map((m) => (
            <button
              key={m}
              onClick={() => { setSleepTimer(m); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 rounded text-[13px] hover:bg-white/[0.05]"
            >
              {m} minutes
            </button>
          ))}
          {sleepAt && (
            <>
              <div className="border-t border-white/[0.06] my-1"></div>
              <button
                onClick={() => { setSleepTimer(null); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 rounded text-[13px] text-red-300 hover:bg-white/[0.05]"
              >
                Cancel timer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
