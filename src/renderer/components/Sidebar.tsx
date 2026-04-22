import { NavLink } from 'react-router-dom'
import { Home, Search, Library, LogOut, Heart, Radio } from 'lucide-react'
import { usePlayer } from '../store/player'
import { authorize, unauthorize } from '../utils/musickit-api'

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/radio', label: 'Radio', icon: Radio },
  { to: '/liked', label: 'Liked', icon: Heart },
]

export function Sidebar() {
  const isAuthorized = usePlayer((s) => s.isAuthorized)
  const isReady = usePlayer((s) => s.isReady)

  return (
    <aside className="fixed top-[var(--titlebar-h)] left-0 bottom-[var(--nowplaying-h)] w-[var(--sidebar-w)] p-3 flex flex-col gap-1 z-30 border-r border-white/[0.04] bg-[rgba(10,8,18,0.72)] backdrop-blur-xl">
      <nav className="flex flex-col gap-1 mt-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all ${
                isActive
                  ? 'bg-white/[0.08] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'text-obsidian-300 hover:text-cream hover:bg-white/[0.035]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'accent-text' : ''} />
                {label}
                {isActive && <span className="ml-auto w-1 h-4 rounded-full accent-bg"></span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <AuthButton ready={isReady} authorized={isAuthorized} />
        <div className="mt-3 px-1 text-[10.5px] text-cream/40 leading-relaxed flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse"></span>
          <span className="flex-1 truncate">{isReady ? 'MusicKit ready' : 'Loading MusicKit…'}</span>
          <span className="font-mono">0.1.0</span>
        </div>
      </div>
    </aside>
  )
}

function AuthButton({ ready, authorized }: { ready: boolean; authorized: boolean }) {
  if (!ready) {
    return (
      <button disabled className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-obsidian-400">
        <span className="w-3 h-3 rounded-full border-2 border-obsidian-400 border-t-transparent animate-spin"></span>
        Connecting…
      </button>
    )
  }
  if (authorized) {
    return (
      <button
        onClick={() => unauthorize().then(() => location.reload())}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-obsidian-300 hover:text-white hover:bg-white/[0.04]"
      >
        <LogOut size={15} /> Sign out
      </button>
    )
  }
  return (
    <button
      onClick={() => authorize().catch(console.error)}
      className="group relative w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-[13px] font-semibold text-obsidian-950 bg-cream hover:bg-white transition overflow-hidden"
    >
      <AppleGlyph />
      <span>Sign in with Apple Music</span>
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
        style={{
          background:
            'linear-gradient(100deg, transparent 30%, rgba(255,180,100,0.35) 50%, transparent 70%)',
        }}
      />
    </button>
  )
}

function AppleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}
