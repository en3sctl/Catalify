import { NavLink, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Home, Search, Library, Heart, Radio, ChevronRight } from 'lucide-react'
import { usePlayer } from '../store/player'
import { authorize } from '../utils/musickit-api'

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
    <aside
      className="fixed top-[var(--titlebar-h)] left-0 bottom-[var(--nowplaying-h)] w-[var(--sidebar-w)] p-3 flex flex-col gap-1 z-30 border-r border-white/[0.04] backdrop-blur-2xl backdrop-saturate-150"
      style={{
        background:
          'linear-gradient(180deg, rgb(var(--accent) / 0.06) 0%, rgba(10,8,18,0.18) 60%, rgba(10,8,18,0.28) 100%)',
        // Pin to its own GPU layer so the backdrop-filter doesn't get
        // re-rasterised every time the page below scrolls or animates —
        // that re-paint is what manifested as horizontal flicker bands.
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
    >
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
        {isAuthorized && <ProfileChip />}
      </div>
    </aside>
  )
}

/**
 * Persistent profile entry at the foot of the sidebar — replaces the
 * old "MusicKit ready / 0.1.0" status line. Shows the user's avatar
 * (chosen on the Profile page) and display name; tapping it opens the
 * full /profile route. Lives in both dev and prod builds.
 */
function ProfileChip() {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const tick = () => {
      window.bombo.store.get<string>('profileName').then((v) => {
        if (!cancelled) setName(v || '')
      })
      window.bombo.store.get<string>('profileAvatar').then((v) => {
        if (!cancelled) setAvatar(v || null)
      })
    }
    tick()
    // Profile page can change these at any time; cheap poll keeps the
    // chip in sync without wiring a cross-component event bus.
    const id = window.setInterval(tick, 1500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])
  return (
    <Link
      to="/profile"
      className="mt-3 group flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition"
      title="Open profile"
    >
      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/[0.06] border border-white/[0.08] flex-shrink-0">
        {avatar ? (
          <img src={avatar} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[12px] font-display text-cream/70">
            {(name || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-[12.5px] font-semibold text-cream">
          {name || 'Set up profile'}
        </div>
        <div className="truncate text-[10.5px] text-cream/45">View profile</div>
      </div>
      <ChevronRight size={14} className="text-cream/40 group-hover:text-cream/80 flex-shrink-0 transition" />
    </Link>
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
  // Sign-out lives on the Profile page now — keeps it from being a
  // single mis-click away in the sidebar's bottom corner. Only the
  // un-authed state still surfaces the prominent sign-in CTA here.
  if (authorized) return null
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
