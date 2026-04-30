import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../store/player'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack keys while typing in inputs
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      const p = usePlayer.getState()
      // Alt+Arrows = browser-style back/forward navigation. Checked
      // before the plain-arrow seek/volume bindings so it wins.
      if (e.altKey && e.code === 'ArrowLeft') { e.preventDefault(); navigate(-1); return }
      if (e.altKey && e.code === 'ArrowRight') { e.preventDefault(); navigate(1); return }
      if (e.code === 'Space') { e.preventDefault(); p.toggle() }
      else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); p.next() }
      else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); p.previous() }
      else if (e.code === 'ArrowRight') { e.preventDefault(); p.seek(Math.min(p.durationMs, p.progressMs + 5000)) }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); p.seek(Math.max(0, p.progressMs - 5000)) }
      else if (e.code === 'ArrowUp') { e.preventDefault(); p.setVolume(Math.min(1, p.volume + 0.05)) }
      else if (e.code === 'ArrowDown') { e.preventDefault(); p.setVolume(Math.max(0, p.volume - 0.05)) }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); p.setVolume(p.volume > 0 ? 0 : 0.8) }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); p.toggleShuffle() }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); p.cycleRepeat() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
